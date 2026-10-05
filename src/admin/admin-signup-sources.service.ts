import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * AdminSignupSourcesService
 *
 * Powers the "Signup Sources" admin dashboard — analytics around which channels
 * (Telegram, Facebook, Instagram, etc.) are bringing in users via the
 * `heard_about_us_from` field captured during registration.
 *
 * The frontend can ask for:
 *   - totals per source within a date range
 *   - the daily breakdown of signups per source (for trend charts)
 *   - top-source convenience fields
 *
 * Source labels are kept verbatim from the registration form. Empty/null values
 * are bucketed under the synthetic label `Unknown`. The set of "known" labels
 * is hardcoded so the donut chart shows a stable color order even on days
 * where one of them has zero signups.
 */
@Injectable()
export class AdminSignupSourcesService {
  /**
   * The closed set of source labels we expect from the register form.
   * Kept in sync with `RegisterPage.tsx` (the dropdown options). Order here
   * controls the visual order in the chart legend / table.
   */
  private static readonly KNOWN_SOURCES = [
    'Telegram',
    'Facebook',
    'Youtube',
    'Tiktok',
    'A friend',
    'Other',
  ];

  private static readonly UNKNOWN_BUCKET = 'Unknown';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getOverview(params: {
    from?: string;
    to?: string;
    tzOffsetMinutes?: number;
  }) {
    // Resolve the date window. We accept ISO strings from the client and fall
    // back to "all time" if either bound is missing — that way the UI can pass
    // only one of them, or none, without crashing.
    const fromDate = params.from ? new Date(params.from) : null;
    const toDate = params.to ? new Date(params.to) : null;
    const tzOffsetMinutes = Number.isFinite(params.tzOffsetMinutes)
      ? Number(params.tzOffsetMinutes)
      : 0;

    // 1) Totals per source within the date window.
    //
    // We use COALESCE(NULLIF(...)) so empty strings get treated the same as
    // NULLs and both end up in the `Unknown` bucket. Without NULLIF, a literal
    // '' value would silently become its own "Unknown" sibling and split the
    // count.
    const totalsQb = this.userRepository
      .createQueryBuilder('user')
      .select(
        `COALESCE(NULLIF(user.heardAboutUsFrom, ''), :unknownLabel)`,
        'source',
      )
      .addSelect('COUNT(user.id)', 'count')
      .setParameter('unknownLabel', AdminSignupSourcesService.UNKNOWN_BUCKET)
      .groupBy(
        `COALESCE(NULLIF(user.heardAboutUsFrom, ''), :unknownLabel)`,
      );

    this.applyDateRange(totalsQb, fromDate, toDate);

    const totalsRaw: Array<{ source: string; count: string }> =
      await totalsQb.getRawMany();

    // 2) Daily breakdown per source — used for the stacked area / line trend.
    //
    // We bucket by the user's local day (calculated by shifting UTC timestamps
    // by `tzOffsetMinutes` before truncating to date). The frontend passes
    // the negative of `new Date().getTimezoneOffset()` so the math reflects
    // the admin's wall-clock day. The default 0 means "use UTC days," which
    // is harmless for analytics.
    const dailyQb = this.userRepository
      .createQueryBuilder('user')
      .select(
        `to_char(date_trunc('day', user.createdAt + (:tzOffsetMinutes::int * INTERVAL '1 minute')), 'YYYY-MM-DD')`,
        'date',
      )
      .addSelect(
        `COALESCE(NULLIF(user.heardAboutUsFrom, ''), :unknownLabel)`,
        'source',
      )
      .addSelect('COUNT(user.id)', 'count')
      .setParameter('tzOffsetMinutes', tzOffsetMinutes)
      .setParameter('unknownLabel', AdminSignupSourcesService.UNKNOWN_BUCKET)
      .groupBy('date')
      .addGroupBy(
        `COALESCE(NULLIF(user.heardAboutUsFrom, ''), :unknownLabel)`,
      )
      .orderBy('date', 'ASC');

    this.applyDateRange(dailyQb, fromDate, toDate);

    const dailyRaw: Array<{ date: string; source: string; count: string }> =
      await dailyQb.getRawMany();

    // 3) Reshape the totals into a stable `{ sourceName: count }` map.
    // We start with every known source set to 0 so the donut chart always
    // shows the full legend (empty slices are still meaningful — "nobody came
    // from Tiktok this month" is itself useful information for a marketer).
    const totals: Record<string, number> = {};
    for (const source of AdminSignupSourcesService.KNOWN_SOURCES) {
      totals[source] = 0;
    }
    totals[AdminSignupSourcesService.UNKNOWN_BUCKET] = 0;

    for (const row of totalsRaw) {
      const label = this.normalizeSourceLabel(row.source);
      totals[label] = (totals[label] || 0) + Number(row.count || 0);
    }

    const totalUsers = Object.values(totals).reduce((sum, v) => sum + v, 0);

    // 4) Pick the top source for the headline KPI card. Ties are broken by
    // alphabetical order (deterministic, no flicker on page refresh). Excludes
    // `Unknown` from the "top source" because marketing wants to know which
    // *named* channel is winning, not "the absence of data is the top result."
    const topSourceEntry = Object.entries(totals)
      .filter(([name, count]) => name !== AdminSignupSourcesService.UNKNOWN_BUCKET && count > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })[0];

    const knownTotal = totalUsers - (totals[AdminSignupSourcesService.UNKNOWN_BUCKET] || 0);
    const topSource = topSourceEntry
      ? {
          name: topSourceEntry[0],
          count: topSourceEntry[1],
          percentOfAll:
            totalUsers > 0 ? (topSourceEntry[1] / totalUsers) * 100 : 0,
          percentOfKnown:
            knownTotal > 0 ? (topSourceEntry[1] / knownTotal) * 100 : 0,
        }
      : null;

    // 5) Reshape the daily rows into `[{ date, counts: { source: n } }]`.
    // We seed every date in the window with every known source at 0 so the
    // trend chart line connects through "empty days" instead of having gaps.
    const dailyMap = new Map<string, Record<string, number>>();
    for (const row of dailyRaw) {
      const date = row.date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, this.emptySourceMap());
      }
      const bucket = dailyMap.get(date)!;
      const label = this.normalizeSourceLabel(row.source);
      bucket[label] = (bucket[label] || 0) + Number(row.count || 0);
    }

    const dailyCounts = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        totals,
        totalUsers,
        knownSources: AdminSignupSourcesService.KNOWN_SOURCES,
        unknownLabel: AdminSignupSourcesService.UNKNOWN_BUCKET,
        topSource,
        dailyCounts,
        range: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null,
        },
      },
    };
  }

  /**
   * Adds `createdAt` filtering to a query builder if either bound is set.
   * Inclusive on both ends — the frontend is responsible for setting `to`
   * to end-of-day if it wants "through today."
   */
  private applyDateRange(
    qb: ReturnType<Repository<User>['createQueryBuilder']>,
    from: Date | null,
    to: Date | null,
  ) {
    if (from && !isNaN(from.getTime())) {
      qb.andWhere('user.createdAt >= :from', { from });
    }
    if (to && !isNaN(to.getTime())) {
      qb.andWhere('user.createdAt <= :to', { to });
    }
  }

  /**
   * Coerces any source value (including null/undefined/whitespace/unknown
   * legacy values) into either a known source label or the Unknown bucket.
   * If the registration form added new options before we updated KNOWN_SOURCES,
   * those still come through unchanged (they appear in `totals` and the
   * frontend will show them — they just won't get a pre-allocated 0).
   */
  private normalizeSourceLabel(raw: string | null | undefined): string {
    if (raw === null || raw === undefined) {
      return AdminSignupSourcesService.UNKNOWN_BUCKET;
    }
    const trimmed = String(raw).trim();
    if (trimmed.length === 0) {
      return AdminSignupSourcesService.UNKNOWN_BUCKET;
    }
    return trimmed;
  }

  private emptySourceMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const source of AdminSignupSourcesService.KNOWN_SOURCES) {
      map[source] = 0;
    }
    map[AdminSignupSourcesService.UNKNOWN_BUCKET] = 0;
    return map;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Universities analytics
  //
  // The register form's "university" field is free-text, so the column is
  // full of variants like:
  //   "Cairo University", "cairo univ.", "Cairo Uni", "C.U.",
  //   "Faculty of Medicine, Cairo University",
  //   "جامعة القاهرة", "كلية طب القاهرة"
  //
  // We need to group these together so the admin sees one canonical row
  // (the most common spelling) with a count that reflects ALL spellings, not
  // a fractured list where the same school appears 8 times.
  //
  // The strategy is "normalize aggressively into a comparison key, then keep
  // the original spellings as aliases of the canonical display name." We
  // don't change anything in the DB — normalization happens at query time so
  // we can iterate the rules without backfills.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Tokens we treat as semantic noise when grouping. If a user writes
   * "Cairo University" and another writes "University of Cairo", we want
   * both to collapse to the token set `{ "cairo" }` so they match.
   *
   * Arabic equivalents are listed alongside so mixed-language entries also
   * land in the same bucket: e.g. "جامعة القاهرة" vs "Cairo University".
   * (We don't actually translate between languages — both reduce to
   * `{ "cairo"/"القاهره" }` respectively. The aliasing UI then surfaces both
   * variants under the same row when the admin clicks to expand.)
   */
  private static readonly UNIVERSITY_NOISE_WORDS = new Set([
    // English
    'university', 'universities', 'uni', 'univ', 'univ.',
    'college', 'colleges',
    'faculty', 'facaulty', 'fauclty', 'fac', // common misspellings
    'of', 'the', 'a', 'an', 'and', '&', 'for', 'in', 'at',
    'medicine', 'medical', 'meds',
    'school', 'schools',
    'egypt', 'egyptian', // very common appendage that doesn't disambiguate
    'student', 'students',
    // Arabic
    'جامعة', 'جامعه',
    'كلية', 'كليه',
    'طب', 'الطب', 'طبي',
    'ال', // standalone Arabic definite article (rare, but cleans some cases)
    'في', 'من', 'و',
  ]);

  /**
   * Reduce wildly different spellings of the same school into a single
   * comparison key. Two inputs that produce the same key are considered
   * the same university for grouping purposes.
   *
   * Pipeline:
   *   1. Trim + lowercase
   *   2. Arabic letter normalization (yaa/alif/taa marbuta variants → canonical)
   *   3. Strip Arabic diacritics (tashkeel) and tatweel
   *   4. Replace all punctuation with spaces
   *   5. Tokenize by whitespace, drop empty tokens
   *   6. Drop noise words (see UNIVERSITY_NOISE_WORDS)
   *   7. Sort tokens alphabetically (makes "Cairo University" and
   *      "University of Cairo" produce the same key)
   *   8. Join back with single spaces
   *
   * Returns null for inputs that reduce to nothing (e.g. just "the" or "."),
   * so callers can bucket those under "Unspecified".
   */
  private normalizeUniversityKey(raw: string): string | null {
    if (!raw) return null;
    let s = String(raw).trim().toLowerCase();
    if (s.length === 0) return null;

    // Arabic letter normalization
    s = s
      .replace(/[ً-ٰٟ]/g, '') // tashkeel diacritics
      .replace(/ـ/g, '')                 // tatweel
      .replace(/[إأآ]/g, 'ا')                  // alif variants → bare alif
      .replace(/ى/g, 'ي')                     // alef maqsura → yaa
      .replace(/ة/g, 'ه')                     // taa marbuta → haa
      .replace(/ؤ/g, 'و')                     // waw with hamza → bare waw
      .replace(/ئ/g, 'ي');                    // yaa with hamza → bare yaa

    // Replace any non-letter/digit character with a space.
    // \p{L} matches Unicode letters (Arabic + Latin etc.), \p{N} digits.
    s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');

    // Tokenize, drop noise, sort for order-independence.
    const tokens = s
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .filter((t) => !AdminSignupSourcesService.UNIVERSITY_NOISE_WORDS.has(t));

    if (tokens.length === 0) return null;
    tokens.sort();
    return tokens.join(' ');
  }

  async getUniversities(params: {
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const fromDate = params.from ? new Date(params.from) : null;
    const toDate = params.to ? new Date(params.to) : null;
    // Cap the displayed top-N. Anything beyond falls into the "Others" tail
    // so the chart doesn't get a 200-row legend.
    const limit = Math.max(1, Math.min(Number(params.limit) || 15, 100));

    const qb = this.userRepository
      .createQueryBuilder('user')
      .select('user.institution', 'institution')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.institution IS NOT NULL')
      .andWhere("TRIM(user.institution) <> ''")
      .groupBy('user.institution');

    this.applyDateRange(qb, fromDate, toDate);

    const rawRows: Array<{ institution: string; count: string }> =
      await qb.getRawMany();

    // Group raw spellings by normalized key.
    // For each group we track:
    //   - total student count
    //   - a "variants" map: original spelling → count (used to pick the
    //     canonical display name AND to show the admin the full alias list)
    type Group = {
      key: string;
      total: number;
      variants: Map<string, number>;
    };
    const groups = new Map<string, Group>();
    // Inputs that normalize to nothing (e.g. "...", " - ") get their own
    // synthetic bucket so we don't lose them entirely.
    let unspecifiedCount = 0;

    for (const row of rawRows) {
      const count = Number(row.count || 0);
      if (count === 0) continue;
      const key = this.normalizeUniversityKey(row.institution);
      if (!key) {
        unspecifiedCount += count;
        continue;
      }
      let group = groups.get(key);
      if (!group) {
        group = { key, total: 0, variants: new Map() };
        groups.set(key, group);
      }
      group.total += count;
      const trimmed = String(row.institution).trim();
      group.variants.set(trimmed, (group.variants.get(trimmed) || 0) + count);
    }

    // Total students with ANY university filled (sum across all groups + the
    // unspecified bucket — they DID type something, it just normalized away).
    const totalWithInstitution =
      Array.from(groups.values()).reduce((sum, g) => sum + g.total, 0) +
      unspecifiedCount;

    // Resolve each group's canonical display name — the most frequent
    // original spelling. Ties broken by alphabetical order. We also expose
    // a "prettified" version (Title Case for Latin, original for Arabic) so
    // the display is consistent even when most users wrote lowercase.
    type GroupRow = {
      key: string;
      canonicalName: string;
      students: number;
      percentOfNamed: number;
      percentOfAll: number;
      variantCount: number;
      variants: Array<{ name: string; count: number }>;
    };

    const sortedGroups: GroupRow[] = Array.from(groups.values())
      .map((group): GroupRow => {
        const variants = Array.from(group.variants.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name);
          });
        const canonical = this.prettifyUniversityName(variants[0].name);
        return {
          key: group.key,
          canonicalName: canonical,
          students: group.total,
          percentOfAll:
            totalWithInstitution > 0
              ? (group.total / totalWithInstitution) * 100
              : 0,
          // "percentOfNamed" excludes the unspecified bucket — useful for
          // "out of users we could classify, what share is each school?"
          percentOfNamed: 0, // filled below once we know the denominator
          variantCount: variants.length,
          variants,
        };
      })
      .sort((a, b) => {
        if (b.students !== a.students) return b.students - a.students;
        return a.canonicalName.localeCompare(b.canonicalName);
      });

    const namedTotal = sortedGroups.reduce((sum, g) => sum + g.students, 0);
    for (const g of sortedGroups) {
      g.percentOfNamed = namedTotal > 0 ? (g.students / namedTotal) * 100 : 0;
    }

    // Split into top-N (charted) and tail (collapsed into one "Others" row
    // so the chart stays legible).
    const top = sortedGroups.slice(0, limit);
    const tail = sortedGroups.slice(limit);
    const tailTotal = tail.reduce((sum, g) => sum + g.students, 0);

    return {
      success: true,
      data: {
        totalWithInstitution,
        totalDistinctUniversities: sortedGroups.length,
        unspecifiedCount, // users who typed something that normalized to nothing
        top,
        tail: tail.length > 0
          ? {
              groups: tail.length,
              students: tailTotal,
              percentOfNamed:
                namedTotal > 0 ? (tailTotal / namedTotal) * 100 : 0,
              percentOfAll:
                totalWithInstitution > 0
                  ? (tailTotal / totalWithInstitution) * 100
                  : 0,
            }
          : null,
        range: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null,
        },
      },
    };
  }

  /**
   * Lightly clean up the user's original spelling for display:
   *   - Trim whitespace
   *   - Collapse internal whitespace
   *   - Title-Case for Latin-script names (so "cairo university" → "Cairo University")
   *   - Leave Arabic untouched (Title Case doesn't apply)
   *
   * This is purely cosmetic — grouping is already done by `normalizeUniversityKey`.
   * We just want the row label to look professional in the table.
   */
  private prettifyUniversityName(raw: string): string {
    const cleaned = String(raw).trim().replace(/\s+/g, ' ');
    if (cleaned.length === 0) return raw;
    // Detect Arabic by checking if any character is in the Arabic Unicode block.
    if (/[؀-ۿ]/.test(cleaned)) {
      return cleaned;
    }
    return cleaned
      .split(' ')
      .map((token) => {
        if (token.length === 0) return token;
        // Preserve all-caps acronyms (e.g. "MIT", "AUC", "UCLA")
        if (token.length <= 4 && token === token.toUpperCase()) return token;
        return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
      })
      .join(' ');
  }
}
