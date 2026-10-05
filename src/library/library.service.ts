import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { LibraryArticle } from "../entities/library-article.entity";
import { LibraryArticleLocation } from "../entities/library-article-location.entity";
import { LibraryTooltip } from "../entities/library-tooltip.entity";
import { ArticleProgress } from "../entities/article-progress.entity";
import { ArticleHighlight } from "../entities/article-highlight.entity";
import { LibraryBookmarkState } from "../entities/library-bookmark-state.entity";
import { LibraryCacheService } from "./library-cache.service";
import {
  LIBRARY_SOURCE_ALIASES,
  LibraryQBank,
  LibrarySource,
  LibrarySourceFilter,
  LibraryStoredSource,
} from "./library-source.constants";

@Injectable()
export class LibraryService implements OnModuleInit {
  constructor(
    @InjectRepository(LibraryArticle)
    private articleRepository: Repository<LibraryArticle>,
    @InjectRepository(LibraryArticleLocation)
    private locationRepository: Repository<LibraryArticleLocation>,
    @InjectRepository(LibraryTooltip)
    private tooltipRepository: Repository<LibraryTooltip>,
    @InjectRepository(ArticleProgress)
    private progressRepository: Repository<ArticleProgress>,
    @InjectRepository(ArticleHighlight)
    private highlightRepository: Repository<ArticleHighlight>,
    @InjectRepository(LibraryBookmarkState)
    private bookmarkStateRepository: Repository<LibraryBookmarkState>,
    private libraryCache: LibraryCacheService,
  ) {}
  private readonly logger = new Logger(LibraryService.name);
  // Per-source mutex so the multi-source boot loop can't collide with each
  // other, and an admin-triggered warm for source X can proceed while boot
  // is still on source Y.
  private warmupInProgress = new Set<string>();

  async onModuleInit() {
    // Master on/off — scripts (import-question-groupings.ts etc.) rely on
    // setting this to "false" to skip the DB-heavy warmup. Prod should set it
    // to "true".
    if (process.env.LIBRARY_CACHE_WARM !== "true") return;

    // Always warm EVERY stored source. No env-list to keep in sync — adding
    // a new source to LibraryStoredSource is enough for it to get cached.
    const sources = Object.values(LibraryStoredSource);

    this.logger.log(
      `[Library] Cache warmup scheduled for ${sources.length} sources: ${sources.join(", ")}`,
    );
    setTimeout(async () => {
      for (const source of sources) {
        await this.warmLibraryCache(source);
      }
    }, 500);
  }

  /**
   * Redis key that records a successful warmup for a source.
   * Presence + matching article count ⇒ warmup is idempotent on restart.
   */
  private warmupMarkerKey(source: string) {
    return `static_library:warmup:${source}:done`;
  }

  async warmLibraryCache(source: string = LibrarySource.AMBOSS, opts?: { force?: boolean }) {
    const normalizedSource = this.normalizeSource(source);
    if (this.warmupInProgress.has(normalizedSource)) {
      this.logger.warn(
        `[Library] Cache warmup already in progress for ${normalizedSource}`,
      );
      return { status: "skipped", reason: "in_progress" };
    }
    this.warmupInProgress.add(normalizedSource);
    // No TTL: library content is static between imports. Import scripts /
    // admin cache-purge endpoints are responsible for invalidation.
    try {
      const total = await this.articleRepository.count({
        where: this.getLibrarySourceFilter(normalizedSource),
      });
      if (total === 0) {
        // Skip caching an empty structure — no TTL means it would stick
        // forever, so a later import wouldn't surface until manual purge.
        this.logger.warn(
          `[Library] Skipping warmup for ${normalizedSource} — 0 articles in DB`,
        );
        return { status: "empty", total: 0 };
      }

      // Idempotency check — if a prior boot already warmed this source and
      // the DB article count hasn't changed, skip the full re-scan. Import
      // scripts / admin purge endpoints delete the marker to force a rewarm.
      if (!opts?.force) {
        const marker = await this.libraryCache.get<{ count: number; at: string }>(
          this.warmupMarkerKey(normalizedSource),
        );
        if (marker && marker.count === total) {
          this.logger.log(
            `[Library] Skipping warmup for ${normalizedSource} — already warm (${total} articles, marked at ${marker.at})`,
          );
          return { status: "already-warm", total };
        }
      }

      this.logger.log(
        `[Library] Warming article cache for ${normalizedSource}...`,
      );

      // Warm structure cache (safe now that we know there's content)
      await this.getStructure(undefined, normalizedSource, false);

      const batchSize = 100;
      for (let offset = 0; offset < total; offset += batchSize) {
        const batch = await this.articleRepository.find({
          where: this.getLibrarySourceFilter(normalizedSource),
          order: { id: "ASC" },
          skip: offset,
          take: batchSize,
        });

        for (const article of batch) {
          await this.libraryCache.set(
            `static_library:article:id:${article.id}`,
            article,
          );
          if (article.externalId) {
            await this.libraryCache.set(
              `static_library:article:ext:${article.externalId}`,
              article,
            );
          }
        }
      }

      // Write completion marker so the next restart can skip the full re-scan.
      await this.libraryCache.set(this.warmupMarkerKey(normalizedSource), {
        count: total,
        at: new Date().toISOString(),
      });

      this.logger.debug(
        `[Library] Cache warmup completed for ${normalizedSource}. Total articles: ${total}`,
      );
      return { status: "ok", total };
    } catch (error) {
      this.logger.error(
        `[Library] Cache warmup failed for ${normalizedSource}`,
        error as any,
      );
      return { status: "error" };
    } finally {
      this.warmupInProgress.delete(normalizedSource);
    }
  }

  /**
   * Purge cache entries for one source, or ALL library cache if source omitted.
   * Meant to be called after an import so users see fresh content immediately.
   *
   * Per-source purge scans the DB for that source's article IDs (because
   * article cache keys are id-scoped, not source-scoped) and deletes each
   * key individually. `all` variant nukes every static_library:* and
   * library_tooltip:* key via SCAN.
   */
  async purgeCache(source?: string): Promise<{ deleted: number; source: string }> {
    if (!source) {
      const articles = await this.libraryCache.deleteByPattern("static_library:*");
      const tips = await this.libraryCache.deleteByPattern("library_tooltip:*");
      const total = articles + tips;
      this.logger.log(`[Library] Cache purged (all sources) — ${total} keys removed`);
      return { deleted: total, source: "all" };
    }

    const normalizedSource = this.normalizeSource(source);
    let deleted = 0;
    deleted += await this.libraryCache.deleteByPattern(
      `static_library:structure:${normalizedSource}`,
    );
    // Kill the warmup completion marker so the next boot re-scans.
    deleted += await this.libraryCache.deleteByPattern(
      this.warmupMarkerKey(normalizedSource),
    );
    deleted += await this.libraryCache.deleteByPattern(
      `library_tooltip:${normalizedSource}:*`,
    );

    const articles = await this.articleRepository.find({
      where: this.getLibrarySourceFilter(normalizedSource),
      select: ["id", "externalId"],
    });
    for (const art of articles) {
      await this.libraryCache.del(`static_library:article:id:${art.id}`);
      deleted += 1;
      if (art.externalId) {
        await this.libraryCache.del(
          `static_library:article:ext:${art.externalId}`,
        );
        deleted += 1;
      }
    }

    this.logger.log(
      `[Library] Cache purged for ${normalizedSource} — ${deleted} keys removed`,
    );
    return { deleted, source: normalizedSource };
  }

  async getStructure(
    userId?: number,
    source: string = LibrarySource.USMLE,
    forceRefresh: boolean = false,
  ) {
    const normalizedSource = this.normalizeSource(source);
    const cacheKey = `static_library:structure:${normalizedSource}`;
    let staticStructure: any[] | null = forceRefresh
      ? null
      : await this.libraryCache.get(cacheKey);

    if (!staticStructure) {
      console.log(
        `[Library] 🔍 Cache MISS for library structure (${normalizedSource}) - fetching from DB`,
      );
      if (normalizedSource === LibrarySource.AMBOSS) {
        staticStructure = await this.buildAmbossStructure();
      } else {
        staticStructure = await this.buildGenericStructure(normalizedSource);
      }
      // Don't cache an empty structure — with no TTL it would trap the source
      // as "empty" forever until a manual purge. Better to fall back to
      // rebuilding on next request (cheap for empty sources anyway).
      if (Array.isArray(staticStructure) && staticStructure.length > 0) {
        await this.libraryCache.set(cacheKey, staticStructure);
      }
    }

    if (!userId) return staticStructure;

    // Overlay user progress
    const userProgress = await this.progressRepository.find({
      where: { userId },
    });
    const readMap = new Map(userProgress.map((p) => [p.articleId, p.isRead]));
    const bookmarkMap = new Map(
      userProgress.map((p) => [p.articleId, p.isBookmarked]),
    );

    // Recursive helper to overlay progress on articles
    const applyProgress = (cats: any[]): any[] => {
      return cats.map((cat) => ({
        ...cat,
        articles: cat.articles.map((art: any) => ({
          ...art,
          isRead: !!readMap.get(art.id),
          isBookmarked: !!bookmarkMap.get(art.id),
        })),
        children: cat.children ? applyProgress(cat.children) : [],
      }));
    };

    return applyProgress(staticStructure);
  }

  async getArticle(id: string | number, userId?: number) {
    const rawId = String(id || "").trim();
    const isNumeric = /^\d+$/.test(rawId);
    const articleId = isNumeric ? Number(rawId) : null;
    const cacheKey = isNumeric
      ? `static_library:article:id:${articleId}`
      : `static_library:article:ext:${rawId}`;

    let article: any = await this.libraryCache.get(cacheKey);

    if (!article) {
      console.log(
        `[Library] 🔍 Cache MISS for article:${rawId} - fetching from DB`,
      );
      let dbArticle = null;
      if (isNumeric && articleId !== null) {
        dbArticle = await this.articleRepository.findOne({
          where: { id: articleId },
        });
      } else {
        dbArticle = await this.articleRepository.findOne({
          where: { externalId: rawId, source: "amboss" },
        });
        if (!dbArticle) {
          dbArticle = await this.articleRepository.findOne({
            where: { externalId: rawId },
          });
        }
      }

      if (!dbArticle) throw new NotFoundException("Article not found");

      article = dbArticle;
      await this.libraryCache.set(cacheKey, article);
      if (!isNumeric) {
        await this.libraryCache.set(
          `static_library:article:id:${dbArticle.id}`,
          article,
        );
      }
    }

    // Map 'name' to 'title', 'contentHtml' to 'content', and provide a virtual category object for frontend
    const response = {
      ...article,
      title: article.name,
      content: article.contentHtml,
      category: { id: article.category, name: article.category },
      isRead: false,
      isBookmarked: false,
    };

    if (userId) {
      const progress = await this.progressRepository.findOne({
        where: { userId: userId, articleId: article.id },
      });
      response.isRead = progress?.isRead || false;
      response.isBookmarked = progress?.isBookmarked || false;
    }

    return response;
  }

  async getArticleByExternalCaller(
    externalCaller: string,
    userId?: number,
    source?: string,
  ) {
    const cleanCaller = String(externalCaller).trim();
    const whereClause: any = { externalCaller: cleanCaller };
    if (source) {
      const normalizedSource = this.normalizeSource(source);
      const sourceFilter = this.getLibrarySourceFilter(normalizedSource);
      whereClause.source = sourceFilter.source;
      if ("qbank" in sourceFilter) {
        whereClause.qbank = sourceFilter.qbank;
      }
    }
    const article = await this.articleRepository.findOne({
      where: whereClause,
    });
    if (!article)
      throw new NotFoundException("Article not found for this external caller");
    const response: any = {
      id: article.id,
      name: article.name,
      title: article.name,
      content: article.contentHtml,
      category: { id: article.category, name: article.category },
      source: article.source,
      isRead: false,
      isBookmarked: false,
    };
    if (userId) {
      const progress = await this.progressRepository.findOne({
        where: { userId, articleId: article.id },
      });
      response.isRead = progress?.isRead || false;
      response.isBookmarked = progress?.isBookmarked || false;
    }
    return response;
  }

  async resolveArticleId(id: string | number) {
    const rawId = String(id || "").trim();
    const isNumeric = /^\d+$/.test(rawId);
    if (isNumeric) return Number(rawId);

    let article = await this.articleRepository.findOne({
      where: { externalId: rawId, source: "amboss" },
    });
    if (!article) {
      article = await this.articleRepository.findOne({
        where: { externalId: rawId },
      });
    }
    if (!article) throw new NotFoundException("Article not found");
    return article.id;
  }

  async markAsRead(articleId: string | number, userId: number) {
    const resolvedArticleId = await this.resolveArticleId(articleId);
    const result = await this.progressRepository.query(
      `
    INSERT INTO article_progress ("userId", "articleId", "isRead", "lastAccessedAt")
    VALUES ($1, $2, true, NOW())
    ON CONFLICT ("userId", "articleId")
    DO UPDATE SET
      "isRead" = NOT article_progress."isRead",
      "lastAccessedAt" = NOW()
    RETURNING "isRead"
    `,
      [userId, resolvedArticleId],
    );

    return { success: true, isRead: result[0].isRead };
  }

  async toggleBookmark(id: string | number, userId: number) {
    const resolvedArticleId = await this.resolveArticleId(id);
    // Atomic upsert-toggle — mirrors markAsRead() above.
    // Uses raw query() because the toggle expression `NOT article_progress."isBookmarked"`
    // references the pre-conflict row value, which repository.upsert() and
    // QueryBuilder.orUpdate() cannot express (both emit EXCLUDED.<col> only).
    // Splitting into findOne-then-conditional-upsert would reintroduce a TOCTOU race.
    const result = await this.progressRepository.query(
      `
    INSERT INTO article_progress ("userId", "articleId", "isBookmarked", "lastAccessedAt")
    VALUES ($1, $2, true, NOW())
    ON CONFLICT ("userId", "articleId")
    DO UPDATE SET
      "isBookmarked" = NOT article_progress."isBookmarked",
      "lastAccessedAt" = NOW()
    RETURNING "isBookmarked"
    `,
      [userId, resolvedArticleId],
    );
    return { success: true, isBookmarked: result[0].isBookmarked };
  }

  async createHighlight(
    userId: number,
    articleId: string | number,
    text: string,
    annotation?: string,
    color: string = "yellow",
    rangeIndex?: number,
  ) {
    const resolvedArticleId = await this.resolveArticleId(articleId);
    const highlight = this.highlightRepository.create({
      userId: userId,
      articleId: resolvedArticleId,
      text,
      annotation,
      color,
      rangeIndex,
    });
    return this.highlightRepository.save(highlight);
  }

  async deleteHighlight(id: string | number, userId: number) {
    const result = await this.highlightRepository.delete({
      id: String(id),
      userId: userId,
    });
    return { success: result.affected && result.affected > 0 };
  }

  async getHighlights(userId: number, articleId: string | number) {
    const resolvedArticleId = await this.resolveArticleId(articleId);
    return this.highlightRepository.find({
      where: { userId: userId, articleId: resolvedArticleId },
      order: { createdAt: "ASC" },
    });
  }

  async getBookmarkState(userId: number) {
    const existing = await this.bookmarkStateRepository.findOne({
      where: { userId },
    });
    if (!existing) {
      return { folders: [], assignments: {} };
    }
    return {
      folders: Array.isArray(existing.folders) ? existing.folders : [],
      assignments: existing.assignments || {},
    };
  }

  async saveBookmarkState(
    userId: number,
    folders: string[] = [],
    assignments: Record<string, string[]> = {},
  ) {
    const normalizedFolders = Array.from(
      new Set((folders || []).map((f) => (f || "").trim()).filter(Boolean)),
    );
    const normalizedAssignments: Record<string, string[]> = {};
    Object.entries(assignments || {}).forEach(([key, value]) => {
      if (!key) return;
      const items = Array.isArray(value) ? value : [];
      normalizedAssignments[String(key)] = Array.from(
        new Set(items.map((v) => String(v)).filter(Boolean)),
      );
    });

    // Atomic upsert — avoids the TOCTOU race where two concurrent PUTs both
    // see findOne()=null and both INSERT, crashing on the UQ (userId).
    // TypeORM's repository.upsert() auto-appends `"updatedAt" = DEFAULT`
    // to the DO UPDATE SET clause for @UpdateDateColumn on Postgres, which
    // resolves to now() via the column's DEFAULT — matching the previous
    // `"updatedAt" = NOW()` behavior.
    await this.bookmarkStateRepository.upsert(
      {
        userId,
        folders: normalizedFolders,
        assignments: normalizedAssignments,
      },
      ["userId"],
    );
    return { folders: normalizedFolders, assignments: normalizedAssignments };
  }

  async getTooltips(eids: string[], source: string = "amboss") {
    const normalizedSource = this.normalizeSource(source);
    if (!eids.length) return {};

    const cleanIds = Array.from(
      new Set(
        eids
          .map((e) => String(e).trim())
          .filter((e) => e.length > 0)
          .slice(0, 200),
      ),
    );

    if (!cleanIds.length) return {};

    const cacheHits: Record<string, string> = {};
    const missing: string[] = [];

    for (const eid of cleanIds) {
      const cacheKey = `library_tooltip:${normalizedSource}:${eid}`;
      const cached = await this.libraryCache.get<string>(cacheKey);
      if (cached) {
        cacheHits[eid] = cached;
      } else {
        missing.push(eid);
      }
    }

    let found: LibraryTooltip[] = [];
    if (missing.length) {
      found = await this.tooltipRepository.find({
        where: { eid: In(missing), source: normalizedSource },
      });

      for (const tip of found) {
        const cacheKey = `library_tooltip:${normalizedSource}:${tip.eid}`;
        await this.libraryCache.set(cacheKey, tip.abstract, 3600 * 1000); // 1h
      }
    }

    const result: Record<string, string> = { ...cacheHits };
    for (const tip of found) {
      result[tip.eid] = tip.abstract;
    }

    return result;
  }

  async searchArticles(
    userId: number,
    query: string,
    source: string = LibrarySource.USMLE,
    limit: number = 50,
    offset: number = 0,
  ) {
    const normalizedSource = this.normalizeSource(source);
    const safeQuery = String(query || "").trim();
    if (!safeQuery) {
      return { total: 0, items: [] };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const tokens = safeQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const isSingleChar = tokens.length == 1 && tokens[0].length == 1;
    const sourceSqlFilter = this.getLibrarySourceSqlFilter(normalizedSource, 2);

    const sourceFilter =
      normalizedSource === LibrarySource.ALL
        ? ""
        : `WHERE ${sourceSqlFilter.clause}`;

    const params =
      normalizedSource === LibrarySource.ALL
        ? [safeQuery, userId, safeLimit, safeOffset]
        : [safeQuery, ...sourceSqlFilter.params, userId, safeLimit, safeOffset];

    if (isSingleChar) {
      const prefix = `${tokens[0]}%`;
      const whereClause = normalizedSource === LibrarySource.ALL
        ? "WHERE"
        : `WHERE ${sourceSqlFilter.clause} AND`;

      const countSql = `
        SELECT COUNT(*) AS total FROM library_articles art
        ${whereClause} (LOWER(art.name) LIKE $1 OR LOWER(art.category) LIKE $1)
      `;
      const sql = `
        SELECT
          art.id,
          art.name AS title,
          art.category,
          art.source,
          NULL AS excerpt,
          0 AS rank,
          COALESCE(p."isRead", false) AS "isRead",
          COALESCE(p."isBookmarked", false) AS "isBookmarked"
        FROM library_articles art
        LEFT JOIN article_progress p
          ON p."articleId" = art.id AND p."userId" = $${normalizedSource === LibrarySource.ALL ? 2 : sourceSqlFilter.nextParamIndex}
        ${whereClause}
          (LOWER(art.name) LIKE $1 OR LOWER(art.category) LIKE $1)
        ORDER BY art.name ASC
        LIMIT $${normalizedSource === LibrarySource.ALL ? 3 : sourceSqlFilter.nextParamIndex + 1}
        OFFSET $${normalizedSource === LibrarySource.ALL ? 4 : sourceSqlFilter.nextParamIndex + 2};
      `;

      const countParams = normalizedSource === LibrarySource.ALL
        ? [prefix]
        : [prefix, ...sourceSqlFilter.params];
      const fastParams =
        normalizedSource === LibrarySource.ALL
          ? [prefix, userId, safeLimit, safeOffset]
          : [prefix, ...sourceSqlFilter.params, userId, safeLimit, safeOffset];

      const [countResult, rows] = await Promise.all([
        this.articleRepository.query(countSql, countParams),
        this.articleRepository.query(sql, fastParams),
      ]);
      const total = Number(countResult[0]?.total ?? 0);

      const items = rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        source: row.source,
        excerpt: row.excerpt,
        isRead: row.isRead,
        isBookmarked: row.isBookmarked,
        rank: Number(row.rank || 0),
      }));

      return { total, items };
    }

    const userParam = normalizedSource === LibrarySource.ALL ? 2 : sourceSqlFilter.nextParamIndex;
    const limitParam = normalizedSource === LibrarySource.ALL ? 3 : sourceSqlFilter.nextParamIndex + 1;
    const offsetParam = normalizedSource === LibrarySource.ALL ? 4 : sourceSqlFilter.nextParamIndex + 2;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM library_articles art
      ${sourceFilter.replace(/WHERE/, 'WHERE') || 'WHERE 1=1'}
        ${sourceFilter ? 'AND' : 'AND'}
        to_tsvector('english',
          coalesce(art.name, '') || ' ' ||
          regexp_replace(coalesce(art.content_html, ''), '<[^>]+>', ' ', 'g')
        ) @@ plainto_tsquery('english', $1)
    `;
    const countParams = normalizedSource === LibrarySource.ALL
      ? [safeQuery]
      : [safeQuery, ...sourceSqlFilter.params];

    const sql = `
      WITH search_query AS (
        SELECT
          websearch_to_tsquery('english', $1) AS query,
          plainto_tsquery('english', $1) AS strict_query,
          lower($1) AS raw_query
      ),
      matched AS (
        SELECT
          art.id,
          art.name,
          art.category,
          art.source,
          art.content_html,
          to_tsvector(
            'english',
            coalesce(art.name, '') || ' ' ||
            regexp_replace(coalesce(art.content_html, ''), '<[^>]+>', ' ', 'g')
          ) AS document,
          q.query,
          q.raw_query,
          ts_rank_cd(
            to_tsvector('english',
              coalesce(art.name, '') || ' ' ||
              regexp_replace(coalesce(art.content_html, ''), '<[^>]+>', ' ', 'g')
            ),
            q.query
          ) AS rank,
          CASE
            WHEN q.raw_query <> '' AND lower(
              coalesce(art.name, '') || ' ' ||
              regexp_replace(coalesce(art.content_html, ''), '<[^>]+>', ' ', 'g')
            ) LIKE '%' || q.raw_query || '%'
              THEN 1
            ELSE 0
          END AS phrase_match
        FROM library_articles art
        CROSS JOIN search_query q
        ${sourceFilter ? sourceFilter + ' AND' : 'WHERE'}
          to_tsvector('english',
            coalesce(art.name, '') || ' ' ||
            regexp_replace(coalesce(art.content_html, ''), '<[^>]+>', ' ', 'g')
          ) @@ q.strict_query
        ORDER BY phrase_match DESC, rank DESC, art.name ASC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      )
      SELECT
        m.id,
        m.name AS title,
        m.category,
        m.source,
        m.rank,
        m.phrase_match,
        ts_headline(
          'english',
          regexp_replace(coalesce(m.content_html, ''), '<[^>]+>', ' ', 'g'),
          m.query,
          'MaxFragments=2, MinWords=6, MaxWords=20, ShortWord=2'
        ) AS excerpt,
        COALESCE(p."isRead", false) AS "isRead",
        COALESCE(p."isBookmarked", false) AS "isBookmarked"
      FROM matched m
      LEFT JOIN article_progress p
        ON p."articleId" = m.id AND p."userId" = $${userParam}
      ORDER BY m.phrase_match DESC, m.rank DESC, m.name ASC;
    `;

    const [countResult, rows] = await Promise.all([
      this.articleRepository.query(countSql, countParams),
      this.articleRepository.query(sql, params),
    ]);
    const total = Number(countResult[0]?.total ?? 0);

    const items = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      source: row.source,
      excerpt: row.excerpt,
      isRead: row.isRead,
      isBookmarked: row.isBookmarked,
      rank: Number(row.rank || 0),
    }));

    return { total, items };
  }

  async getAdminStructure() {
    const allArticles = await this.articleRepository.find({
      select: ["id", "name", "category", "qbank"],
      where: { source: LibrarySource.USMLE },
      order: { category: "ASC", name: "ASC" },
    });

    const categoryMap = new Map<string, any[]>();
    allArticles.forEach((art) => {
      const cat = art.category || "Uncategorized";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)?.push({
        id: art.id,
        title: art.name,
        qbank: art.qbank,
      });
    });

    return Array.from(categoryMap.entries()).map(([name, articles]) => ({
      id: name,
      name,
      articles,
      articlesCount: articles.length,
      children: [],
    }));
  }

  async getAdminArticle(id: number) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  async createAdminArticle(data: {
    name: string;
    category: string;
    contentHtml: string;
    qbank?: string;
  }) {
    const article = this.articleRepository.create({
      name: data.name,
      category: data.category,
      contentHtml: data.contentHtml,
      qbank: data.qbank,
      source: LibrarySource.USMLE,
      externalId: null,
    });

    const saved = await this.articleRepository.save(article);
    await this.invalidateStructureCache("usmle");
    return saved;
  }

  async updateAdminArticle(
    id: number,
    data: Partial<{
      name: string;
      category: string;
      contentHtml: string;
      qbank?: string;
    }>,
  ) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException("Article not found");

    Object.assign(article, data);
    const saved = await this.articleRepository.save(article);

    await this.invalidateStructureCache(article.source || "usmle");
    await this.invalidateArticleCache(id);
    return saved;
  }

  async deleteAdminArticle(id: number) {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException("Article not found");
    await this.articleRepository.delete({ id });
    await this.invalidateStructureCache(article.source || "usmle");
    await this.invalidateArticleCache(id);
    return { success: true };
  }

  private normalizeSource(source?: string) {
    const normalized = String(source || LibrarySource.USMLE)
      .trim()
      .toLowerCase();
    return LIBRARY_SOURCE_ALIASES[normalized] || normalized;
  }

  private getLibrarySourceFilter(
    normalizedSource: string,
  ): LibrarySourceFilter {
    if (normalizedSource === LibrarySource.PASSMEDICINE) {
      return {
        source: LibraryStoredSource.PASSMEDICINE,
      };
    }
    if (normalizedSource === LibrarySource.PASTEST) {
      return {
        source: LibraryStoredSource.PASTEST,
        qbank: LibraryQBank.PASTEST,
      };
    }
    if (normalizedSource === LibrarySource.PASTEST_2) {
      return {
        source: LibraryStoredSource.PASTEST_2,
      };
    }
    return {
      source: normalizedSource as LibraryStoredSource | LibrarySource.ALL,
    };
  }

  private getLibrarySourceSqlFilter(
    normalizedSource: string,
    startParamIndex: number,
  ) {
    const sourceFilter = this.getLibrarySourceFilter(normalizedSource);
    if ("qbank" in sourceFilter) {
      return {
        clause: `art.source = $${startParamIndex} AND art.qbank = $${startParamIndex + 1}`,
        params: [sourceFilter.source, sourceFilter.qbank],
        nextParamIndex: startParamIndex + 2,
      };
    }

    return {
      clause: `art.source = $${startParamIndex}`,
      params: [sourceFilter.source],
      nextParamIndex: startParamIndex + 1,
    };
  }

  private normalizeCategoryPath(path: string) {
    const parts = String(path || "")
      .split(">")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts[0]?.toLowerCase() === "amboss library") {
      parts.shift();
    }
    return parts;
  }

  private async buildGenericStructure(source: string = LibrarySource.USMLE) {
    const allArticles = await this.articleRepository.find({
      select: ["id", "name", "category", "qbank"],
      where: this.getLibrarySourceFilter(source),
      order: { category: "ASC", name: "ASC" },
    });

    // Build a nested tree from ">" delimited category paths
    const rootMap = new Map<string, any>();

    const ensureNode = (map: Map<string, any>, name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          id: name,
          name,
          children: [],
          articles: [],
          _childrenMap: new Map<string, any>(),
          _articleIds: new Set<number>(),
        });
      }
      return map.get(name);
    };

    for (const art of allArticles) {
      const raw = art.category || "Uncategorized";
      const segments = raw
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);

      // If only one segment (no ">"), use flat structure like before
      let currentMap = rootMap;
      let currentNode: any = null;

      for (const segment of segments) {
        currentNode = ensureNode(currentMap, segment);
        currentMap = currentNode._childrenMap;
      }

      if (currentNode && !currentNode._articleIds.has(art.id)) {
        currentNode._articleIds.add(art.id);
        currentNode.articles.push({ id: art.id, title: art.name });
      }
    }

    const finalize = (map: Map<string, any>): any[] => {
      return Array.from(map.values()).map((node) => ({
        id: node.id,
        name: node.name,
        articles: node.articles,
        children: finalize(node._childrenMap),
      }));
    };

    return finalize(rootMap);
  }

  private async buildAmbossStructure() {
    const rows = await this.locationRepository
      .createQueryBuilder("loc")
      .innerJoin(LibraryArticle, "art", "art.id = loc.articleId")
      .select("loc.categoryPath", "categoryPath")
      .addSelect("art.id", "articleId")
      .addSelect("art.name", "articleName")
      .where("art.source = :source", { source: LibrarySource.AMBOSS })
      .orderBy("loc.categoryPath", "ASC")
      .addOrderBy("art.name", "ASC")
      .getRawMany();

    const allAmboss = await this.articleRepository.find({
      select: ["id", "name"],
      where: { source: LibrarySource.AMBOSS },
    });

    const locatedIds = new Set<number>(
      rows.map((r: any) => Number(r.articleId)),
    );

    const rootMap = new Map<string, any>();

    const ensureNode = (map: Map<string, any>, name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          id: name,
          name,
          children: [],
          articles: [],
          _childrenMap: new Map<string, any>(),
          _articleSet: new Set<string>(),
        });
      }
      return map.get(name);
    };

    const addArticleToNode = (
      node: any,
      articleId: number,
      articleName: string,
    ) => {
      const key = `${node.id}:${articleId}`;
      if (node._articleSet.has(key)) return;
      node._articleSet.add(key);
      node.articles.push({ id: articleId, title: articleName });
    };

    for (const row of rows) {
      const rawPath = row.categoryPath;
      const segments = this.normalizeCategoryPath(rawPath);
      const pathSegments = segments.length ? segments : ["Uncategorized"];

      let currentMap = rootMap;
      let currentNode: any = null;

      for (const segment of pathSegments) {
        currentNode = ensureNode(currentMap, segment);
        currentMap = currentNode._childrenMap;
      }

      if (currentNode) {
        addArticleToNode(currentNode, Number(row.articleId), row.articleName);
      }
    }

    const uncategorized = allAmboss.filter((a) => !locatedIds.has(a.id));
    if (uncategorized.length) {
      const node = ensureNode(rootMap, "Uncategorized");
      uncategorized.forEach((a) => addArticleToNode(node, a.id, a.name));
    }

    const finalize = (map: Map<string, any>) => {
      return Array.from(map.values()).map((node) => ({
        id: node.id,
        name: node.name,
        articles: node.articles,
        children: finalize(node._childrenMap),
      }));
    };

    return finalize(rootMap);
  }

  private async invalidateStructureCache(source?: string) {
    if (source) {
      await this.libraryCache.del(
        `static_library:structure:${this.normalizeSource(source)}`,
      );
      return;
    }
    await this.libraryCache.del(
      `static_library:structure:${LibrarySource.USMLE}`,
    );
    await this.libraryCache.del(
      `static_library:structure:${LibrarySource.AMBOSS}`,
    );
    await this.libraryCache.del(
      `static_library:structure:${LibrarySource.PASSMEDICINE}`,
    );
  }

  private async invalidateArticleCache(articleId: number) {
    await this.libraryCache.del(`static_library:article:id:${articleId}`);
  }
}
