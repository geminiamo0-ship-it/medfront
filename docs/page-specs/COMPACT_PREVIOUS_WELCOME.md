# Compact Previous Tests actions and dense Welcome card layout

Approved by user 2026-10-10 after AMBOSS Step 2 screenshot. Issue [#62](https://github.com/geminiamo0-ship-it/medfront/issues/62). Parent features [#55](https://github.com/geminiamo0-ship-it/medfront/issues/55), [#60](https://github.com/geminiamo0-ship-it/medfront/issues/60) retain independent real-auth Cloudflare gate.

## Visual / responsive design
- Preserve existing semantic token palette, QBank workspace, title and table/card columns. Do not hardcode accent/retheme.
- Welcome first desktop row: Original/Repeat Score LEFT, QBank Usage RIGHT. Second: Answer Changes LEFT, Test Count RIGHT. Dedicated compact median and average timing summary, then center full-width Overall Percentile Rank LAST. Stack in this same priority on mobile/tablet; no unused half-width gap. Show actual `bank.name` as header identity (fallback authoritative `qBankName`), never `Bank #ID`.
- Score remains first-attempt/last-retry phase-specific, other sections explicitly Overall across all attempts. Rank is not represented as phase-specific; keep existing server numbers. Usage data inconsistencies are tracked separately; frontend does not lie or recalculate.
- Previous Tests desktop uses icons (Results, Review attempt or Continue/Resume) and one `More actions` overflow menu. Mobile/tablet use same 44px touch targets. Keep `Previous Tests` history and exact status states, long-name Details, Copy Test ID, Repeat and Delete. Menu actions: Review Original Test (existing backend `originalReviewId` when completed), Review Latest Repeat when available, Repeat, Copy Internal Test ID, Delete with visible second confirmation step. Close on Escape and outside pointer click; visible keyboard focus/aria labels/title. Avoid overflow; no separate full-text action buttons in row.
- Two explicit historical review semantics: `Review First Answers` loads read-only `/test/:id?review=original` (backend medhvgg#45; earliest surviving answered submission for each question across owned tests, incl Custom, exactly as user requested). `Review Original Test` (only for a repeat's different root test) still links `originalReviewId`. Do not conflate the two. The new endpoint must ship before frontend link can be used in live deployment. No fake option overlay or unsafe history rewriting.

## Implementation/contracts
- Pages orchestrate existing `src/api/tests.ts` typed GET/POST/DELETE; no new access logic client-side. Results/test paths unchanged and authorized by backend.
- Original and Repeat tabs maintain server-driven stats and query keys. Menu is local transient state only; Repeat disabled while pending; delete requires confirm and invalidates caches after server confirms.
- Companion backend additive opt-in answer projection (medhvgg#45), no migration or mutation. Frontend reading is routed via existing typed Exam API, with query key separating normal/Original. Historical banner identifies current mode. No new DB schema.

## Acceptance/verification
- Desktop 1280, tablet 834, mobile 390: card ordering and no horizontal overflow; compact actions table/cards, accessible labels and focus, Escape/outside close, cancel-delete cannot call API, review URLs use saved internal owned IDs; status correct for completed, suspended, in-progress.
- GitHub Actions Verify (typecheck/lint/build) and AMBOSS Browser Smoke (mocked API) must pass; backend security/Jest+Railway SUCCESS first; Cloudflare deployed-version/live signed-in acceptance remains explicitly open until witnessed.
