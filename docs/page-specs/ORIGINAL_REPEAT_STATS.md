# Original / Repeat progress and review — approved 2026-10-10

Status: SPEC APPROVED (user approved layout/semantics in conversation; issue #60). Parent previous-tests issue #55 remains independently VERIFYING.

## Purpose and routes
- Welcome `/qbank/:bankId/welcome?step=N`: keep existing responsive score-card grid and token palette. Add keyboard-accessible Original and Repeat segmented tabs, default Original. No layout redesign.
- Previous Tests `/qbank/:bankId/previous-tests?step=N`: retain table and mobile cards. Completed root/original test has Review Original and, if an owned completed repeat exists, Review Latest Repeat. Individual repeat/Custom test retains its own Review/Results. Incomplete repeat never masquerades as reviewable.

## Exact server semantics
- Original = earliest surviving answered submission per (user, question) from a real test; immutable against future answers unless its source test is deleted. Order by submittedAt then submission id. Question result counted once.
- Repeat = most recent surviving answered submission strictly after Original for that question (all modes, including Custom and test Repeat); always one result/question. Other old attempts survive in DB/history.
- Delete = existing owner-scoped delete of one test and its records; recompute classifications using surviving test submissions. No global reset and no destructive collapse of repeats.
- Original and Repeat are *statistics views*, NOT Create Test selection filters. Canonical latest-answer Correct/Incorrect, Used/Unused, Omitted and Marked modes remain unchanged.
- Repeating a repeated test creates a new attempt, but binds provenance to the owned original for stable review grouping. Old repeat chains may require a compatibility follow-up.
- Repeated attempts can be triggered from Custom; classification is per QUESTION, not based on test title/mode.
- Stats include answered correct/incorrect and coverage counts for selected phase. Non-phase metrics (usage/test counts/peer percentiles etc.) are overall only, should be labeled as such or not shown on Repeat to avoid misrepresentation. No mock numbers.

## API/security/state
- Extend authenticated `GET /tests/performance/statistics?qBankCode=&step=&view=original|repeat`; backend validates view. Default omission maintains legacy response for older consumers. Preserve locked bank (423) and auth/entitlement checks.
- Extend owner-scoped previous-tests-summary with completed latest-repeat review ID for root rows, never expose foreign-user IDs or raw filter JSON. No N+1 per row.
- TanStack Query keys include view and bank/step. No client-side scoring or localStorage. Server remains authoritative.

## Accessible responsive interactions
- Tabs use `role=tablist`, `role=tab`, `aria-selected`, visible focus, min 44px touch target; changed view is announced by heading/score; cards stack at mobile, existing desktop grid stays unchanged. Error/loading/locked/empty Repeat states are explicit.
- Previous Tests action group wraps gracefully on mobile/tablet and preserves normal Review if no completed Repeat.

## Verification/risks
- Backend tests for chronology, deletion, Custom, repeat lineage, ownership; frontend typecheck/lint/build + Chromium desktop (1280+), tablet (834), mobile (390), keyboard/locked/loading/empty; real signed-in Railway/Cloudflare acceptance before DONE.
- No migration or data rewrite for statistics derivation. Do not silently claim phase-specific percentile/timing unless implemented and validated.
