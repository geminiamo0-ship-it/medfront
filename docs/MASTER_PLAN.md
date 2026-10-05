# MedPark A→Z Master Plan

This is the long-range product/engineering sequence for completing `medfront` against the canonical backend `medhvgg` without turning the frontend into a second business-logic backend.

The master tracking issue is GitHub Issue #1. `PROJECT_STATUS.md` decides which phase is currently active.

## Operating principle

The sequence is deliberately gated:

**inspect → discuss style/UX → approve page spec → implement → test → browser verify → CI verify → update issue/docs → Done**

A later phase may be reprioritized by the user, but the page-design and verification gates never disappear.

---

## G0 — Governance and verification foundation

**Goal:** make the repository self-explanatory and safe for multiple AIs/developers.

Deliverables:
- canonical repo ownership documented;
- `PROJECT_STATUS.md` and `AGENTS.md`;
- engineering guardrails;
- page delivery/spec workflow;
- backend capability map;
- corrected API/reference docs;
- GitHub issue hierarchy;
- GitHub Actions `Verify` baseline.

**Exit gate:** #2 complete and `Verify` green.

---

## G1 — Stabilize what already exists

**Goal:** do not build major new pages on top of known correctness/fidelity defects.

### Create Test
- fix mixed mode string to `mixed_modes`;
- make custom UW-ID validation explicit; never silently truncate;
- split metadata filters from final creation/count filters;
- verify single-mode, mixed-mode and custom test creation end-to-end against the canonical live backend;
- tighten API types touched by the fixes;
- decompose Create Test only where responsibilities changed, not as a wholesale rewrite.

### Library
- preserve API/dictionary/link-suggest spans in High-yield behavior;
- visually verify ordered-list markers across High-yield on/off and light/dark;
- regression-check search, article navigation, annotations/highlights, notebook, AI summary, popovers, images and split behavior.

### Existing shell regression
- auth flows;
- Hub;
- Dashboard;
- QBank listing/provider/bank workspace;
- Previous Tests;
- navigation/access states.

**Exit gate:** #3 complete with live/browser evidence and CI green.

---

## G2 — Exam Runner and Results/Review

This is the largest missing core learner workflow.

### G2.0 Design/spec first
Before code, discuss and approve:
- desktop and mobile structure;
- toolbar/control order;
- question stem/options styling;
- question navigator;
- answer states;
- Tutor vs Timed visual differences;
- timer/elapsed-time behavior;
- fullscreen;
- mark/highlight interaction;
- notes/reference/library/notebook access;
- suspend/resume/leave protection;
- End Block/Complete confirmation;
- explanation and AI explanation presentation;
- results/review layout;
- keyboard shortcuts/accessibility;
- offline/network/retry messaging.

Record in `docs/page-specs/EXAM_RUNNER.md` and a results/review spec if separated.

### G2.1 Contract layer
Wrap/type canonical backend lifecycle endpoints:
- fetch test;
- submit answer;
- timed batch submit;
- mark;
- highlights;
- explanation;
- AI explanation/cache;
- complete;
- suspend;
- resume;
- results;
- feedback;
- rename/delete where surfaced.

### G2.2 Runner shell
- sanitized watermarked stem/options;
- prev/next and quick navigation;
- current/answered/marked state;
- responsive layout;
- keyboard/focus rules.

### G2.3 Tutor execution
- answer persistence;
- correctness/explanation only when allowed;
- retries/idempotent UI behavior;
- timing and answer-change metadata as contract requires.

### G2.4 Timed/block execution
- buffered selections where canonical flow expects it;
- batch End Block;
- expiry/server auto-complete handling;
- locked result semantics;
- omit/unanswered behavior.

### G2.5 Study tools inside runner
Only what the approved runner spec includes:
- mark for review;
- highlights;
- question notes;
- notebook/library/reference side panels;
- feedback;
- AI explanation.

### G2.6 Session resilience
- refresh/reload;
- suspend/resume;
- leave warning/protection;
- network interruption;
- stale session/access errors;
- duplicate-click/retry safety.

### G2.7 Results and review
- score/summary;
- correct/chosen/omitted review;
- per-question navigation;
- explanation/options explanation;
- analytics surfaced only when meaningful;
- return paths to QBank/revision/study tools.

**Exit gate:** a created test is fully playable from start → answer/navigation → suspend/resume → finish → results/review, with Tutor and Timed paths covered.

---

## G3 — Study tools

Activate each as a separate design-first page/feature issue.

### Flashcards
Backend already supports decks, flashcard CRUD, question-linked cards, spaced repetition study state, rating, bury/suspend/reschedule and export.

Potential frontend surfaces:
- deck list;
- deck/card management;
- create from question/explanation;
- study session;
- review scheduling/status;
- export.

### Revision
Backend supports revision overview, active sessions, session creation, progress/completion and history deletion.

Potential surfaces:
- marked-question revision dashboard;
- active revision session;
- progress/history.

### Notes and Notebook
Backend has both question notes and notebook entries. Define clear UX ownership before exposing both so users do not get two confusing note systems.

**Exit gate:** chosen study-tool scope complete with no duplicated persistence model.

---

## G4 — Analytics, streaks, goals, badges and AI Analyst

Do not make the frontend compute canonical analytics already aggregated by the backend.

Potential sequence:
- performance overview redesign/spec;
- subject/system/topic/difficulty/bank drill-down;
- test analytics/results insights;
- streak and daily activity history;
- goals;
- badges;
- AI Analyst scope based on real backend data and approved product purpose.

Important: distinguish historical analytics docs from current canonical backend behavior before exposing a metric.

**Exit gate:** every displayed metric has a documented backend source/meaning and graceful low-data state.

---

## G5 — Account, Settings and Commercial Access

Design Settings as a coherent information architecture rather than one giant form.

Candidate sections:
- profile;
- preferences;
- password/security;
- privacy/account actions;
- subscription/access status;
- pricing/plans;
- manual payment flow if still product-relevant;
- payment/subscription history where supported.

Never infer entitlement client-side; render the backend decision.

**Exit gate:** account/security/access paths verified including denial/expiry/failure states.

---

## G6 — Contests, Community and Support

### Contests
Canonical backend already implements a substantial contest lifecycle. Before frontend reconstruction, discuss desired competition UX and which backend features are intended for this product version.

### Messages
Design conversations/inbox only if product scope still needs it.

### Tickets/help
Use user-scoped ticket endpoints and clear support-state UX.

**Exit gate:** only approved community/support surfaces are exposed; no dormant backend feature is shipped accidentally merely because it exists.

---

## G7 — Public and ancillary experiences

Possible domains include careers/jobs and other public surfaces supported by the backend.

Each gets a separate product decision and design issue. Do not delay core learner flows for ancillary reconstruction unless explicitly reprioritized.

---

## G8 — Admin and Support operations

Treat this as a product in its own right, not a collection of raw CRUD screens.

Potential workspaces discovered in the canonical backend:
- admin shell and role gating;
- users and admin notes;
- questions/content/groupings;
- library management;
- subscriptions/manual payments/pricing;
- coupons/affiliate;
- badges/settings/notifications;
- security/activity/health operational views;
- careers management;
- finance/wallet/payroll/expenses;
- support-role workspace.

Every workspace gets its own spec and authorization-state verification.

---

## G9 — Hardening

Run across the whole product:
- accessibility;
- keyboard/focus;
- responsive/mobile;
- loading/empty/error/locked/429/offline/session-expiry states;
- sanitization/XSS review;
- auth/access/privacy review;
- dependency/runtime audit where relevant;
- browser compatibility;
- bundle/render/network performance;
- regression E2E suite;
- API contract smoke suite;
- targeted load/performance checks on critical backend flows.

Historical audit findings are re-tested against current code rather than copied as present facts.

---

## G10 — Release readiness

- reconcile all active issues;
- ensure all intended pages have approved/current specs;
- `Verify` green on release commit;
- production env/config review;
- smoke critical journeys in production-like environment;
- document known limitations;
- update `PROJECT_STATUS.md` to production truth;
- freeze/update docs;
- release/tag as appropriate.

---

# Cross-phase quality tracks

These are not separate future cleanup projects; they happen with every active page.

## Architecture
- backend remains authoritative;
- feature boundaries stay coherent;
- no hidden duplicate state.

## UX consistency
- page style discussed before implementation;
- shared primitives/tokens used intentionally;
- loading/error/empty states treated as designed states.

## Accessibility
- semantics, keyboard, focus and mobile defined in every spec.

## Verification
- typecheck/lint/build always;
- automated tests when available;
- browser checks for user-visible behavior;
- real API/E2E for critical paths;
- GitHub Actions `Verify` before Done.

## Documentation
- page spec + feature docs + active issue + `PROJECT_STATUS.md` move with the code.
