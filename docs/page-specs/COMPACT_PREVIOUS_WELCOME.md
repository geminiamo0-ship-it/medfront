# Compact Previous Tests actions and dense Welcome card layout

Approved by user 2026-10-10 after AMBOSS Step 2 screenshot. Issue [#62](https://github.com/geminiamo0-ship-it/medfront/issues/62). Parent features [#55](https://github.com/geminiamo0-ship-it/medfront/issues/55), [#60](https://github.com/geminiamo0-ship-it/medfront/issues/60) retain independent real-auth Cloudflare gate.

## Visual / responsive design
- Preserve existing semantic token palette, QBank workspace, title and table/card columns. Do not hardcode accent/retheme.
- Welcome first desktop row: Original/Repeat Score LEFT, QBank Usage RIGHT. Second: Answer Changes LEFT, Test Count RIGHT. Dedicated compact median and average timing summary, then center full-width Overall Percentile Rank LAST. Stack in this same priority on mobile/tablet; no unused half-width gap. Show actual `bank.name` as header identity (fallback authoritative `qBankName`), never `Bank #ID`.
- Score remains first-attempt/last-retry phase-specific, other sections explicitly Overall across all attempts. Rank is not represented as phase-specific; keep existing server numbers. Usage data inconsistencies are tracked separately; frontend does not lie or recalculate.
- Previous Tests desktop uses icons (Results, Review attempt or Continue/Resume) and one `More actions` overflow menu. Mobile/tablet use same 44px touch targets. Keep `Previous Tests` history and exact status states, long-name Details, Copy Test ID, Repeat and Delete. Menu actions: Review Original Test (existing backend `originalReviewId` when completed), Review Latest Repeat when available, Repeat, Copy Internal Test ID, Delete with visible second confirmation step. Close on Escape and outside pointer click; visible keyboard focus/aria labels/title. Avoid overflow; no separate full-text action buttons in row.
- Important distinction: the server's `originalReviewId` is the root saved test, NOT guaranteed earliest answer ever for every question if earlier Custom sessions include the same question. Do not call this canonical per-question first-answered view; separate backend scoped work required for it. No fake answer overlay or unsafe history rewriting.

## Implementation/contracts
- Pages orchestrate existing `src/api/tests.ts` typed GET/POST/DELETE; no new access logic client-side. Results/test paths unchanged and authorized by backend.
- Original and Repeat tabs maintain server-driven stats and query keys. Menu is local transient state only; Repeat disabled while pending; delete requires confirm and invalidates caches after server confirms.
- No backend/database schema changes for this focused UI issue.

## Acceptance/verification
- Desktop 1280, tablet 834, mobile 390: card ordering and no horizontal overflow; compact actions table/cards, accessible labels and focus, Escape/outside close, cancel-delete cannot call API, review URLs use saved internal owned IDs; status correct for completed, suspended, in-progress.
- GitHub Actions Verify (typecheck/lint/build) and AMBOSS Browser Smoke (mocked API) must pass; Cloudflare deployed-version/live signed-in acceptance remains explicitly open until witnessed.
