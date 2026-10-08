# MedPark Results V1 — Approved Spec

**Issue:** medfront #51 / backend #34
**Status:** IMPLEMENTING / VERIFYING
**Approved:** 2026-10-09, in chat, after reviewing user's AMBOSS-style Results reference.
**Route:** `/test/:testId/results` (shared for every bank, independently themed Exam Runner).
**User decision:** simple English medical analytics. Exclude rank, percentile, three-digit predictions, memes/audio and article lists. Show only actual topic names and current backend performance data; no new Shell branding.

## Layout — desktop, tablet and mobile

Full-viewport Results page with reusable theme-token canvas/surface, no new shell or global header. Headline + exam title + Previous Tests link. Responsive stat cards (2 columns phone, 3–4 wide) for Accuracy, Completed Qs, Correct, Incorrect, Omitted, Total Time, Average / Answered Q. Donut for correct/incorrect/omitted. Study Recommendations names only for topics with actual incorrect answers in THIS test and correct/total, limited to six, with note that small samples cannot define the student's overall ability. Five-tier difficulty bars (Very Easy to Very Hard), plus Unclassified only if stored difficulty unavailable. Review Questions + Previous Tests actions.

No extra visuals, article browsing, peer comparison, rank, hints, AI or score prediction in V1.

## Backend contract and ownership

`GET /tests/:id/results` authenticated and owned by canonical `medhvgg`. Existing endpoint returns `test`, `analytics.overall`, `advancedAnalytics`; backend Issue #34 adds `analytics.sessionBreakdown` with accurate per-difficulty correct/wrong/omitted and per-primary-topic name/correct/total based only on the test's questions and final submissions. The client doesn't estimate difficulty or remap article segments. Stored `tests.timeSpentSeconds` is authoritative; average is per ANSWERED question (zero answered => dash). Accuracy is correct/total including omitted in denominator.

The existing analytics snapshots persist at completion, but category metadata for past reports currently comes from current question classification, not an immutable historical category snapshot. Don't claim historical topic/difficulty labels immutable if imported records change.

## Lifecycle

When active Tutor/Timed transitions to completed after successful server completion, navigate to Results. Timed auto-complete also transitions. If completion fails, don't navigate. Completed tests opened for question review remain in existing Exam Runner. Previous Tests links completed -> Results, active/suspended -> current Runner. Full Previous Tests redesign deferred.

## Loading / access / error / security

TanStack Query loading/error states; invalid ID; 401/403/404 generic unavailable; 423 block-results lock; incomplete test with Return to Exam; optional breakdown omitted if old backend; zero-answer safe; no fabricated values. No extra API for screenshot/generation. App auth wrapper ProtectRoute remains authoritative.

## Verification

- [ ] Backend pure helper unit tests + GitHub Actions Verify
- [ ] Frontend Typecheck + Lint + Build + GitHub Actions Verify
- [ ] Browser: Tutor End→Results; Timed End→Results; Review Questions returns to completed AMBOSS theme
- [ ] Browser: phone no horizontal scroll
- [ ] Browser: completed Previous Tests points to Results; in-progress/Suspended retains runner
- [ ] Live signed-in Railway + Cloudflare real test results proof; no DONE label before live acceptance

## 2026-10-09 Visual polish checkpoint (user approved from side-by-side screenshots)

**Focused issue:** #undefined, SPEC APPROVED. The current light page is readable but the seven equal metric cards, oversized donut whitespace and tall empty recommendations card waste screen space. The second concept is the **density and hierarchy reference only**, not its black background, RTL, tiny fonts or Community Comparison panel.

- **Desktop:** compact heading with previous-tests link and subtle completion count; four priority metrics in one even row: Accuracy, Correct/Total, Avg per Answered Q, Total Time. A balanced results card with readable 150–170px donut + visible correct/incorrect/omitted legend, with a separate recommendation card that can be short when empty. Compact five-tier difficulty tracks below; no ranking or derived score.
- **Tablet:** 2-column summary metrics, two content panels where room permits; avoid a fixed giant panel height.
- **Mobile:** two-column summary metrics, vertically stacked donut/legend/recommendations and difficulty rows, minimum readable 12–14px body text, overflow-free and tappable Previous Tests/Review Questions.
- **Color/theme:** scoped CSS custom properties for page surfaces, text, tracks and meaning (success/error/omitted). Light default matches current site; opt-in dark class/data-theme uses dark values. No site-wide shell/theming refactor or branding-orange dependence. Don't use color alone for success/wrong counts.
- **Accuracy:** exactly one decimal (e.g. **2.5%**) in both headline and donut, even if circle is visually rounded; maintain Correct/Incorrect/Omitted and Completed counts with no rounding of question counts.
- **Empty state:** compact message when there are no wrong answers; do NOT claim excellent mastery if most questions are omitted. Topic list uses only real backend primary names and correct/total. All data remain server-authoritative; no backend changes.
- **Acceptance gates:** the browser smoke captures desktop/tablet/mobile Results screenshots, asserts both accuracy displays have 2.5% for a 1/40 fixture, checks conditional Recommendations empty state, no horizontal overflow, charts/labels and existing Tutor/Timed completion + review navigation. Verify TypeScript, ESLint and build; run CI before merge. Cloudflare authenticated live result is an independent gate.
