# Canonical Backend Capability Map

**Canonical backend:** `geminiamo0-ship-it/medhvgg` → `main`  
**Purpose:** prevent frontend duplication and make page planning start from real server capabilities.

This map is based on the current backend tree plus inspection of key controllers/services. It is a capability inventory, not a substitute for re-reading the exact DTO/controller/service when a page becomes active. Endpoint details must be re-verified against current `medhvgg/main` during that page's DESIGN phase.

`medfront/backend` is a historical/reference snapshot only.

---

## 1. Platform/security foundation

Backend areas include:
- application bootstrap and production env validation;
- Helmet/CSP and CORS configuration;
- global validation;
- JWT/role guards;
- global throttling/rate-limit infrastructure;
- IP/security guards;
- maintenance interceptor;
- response-encryption interceptor;
- security quotas/content-security/watermarking;
- activity logging;
- Redis caching;
- health/database monitoring.

### Frontend implication
Do not rebuild security/access/quota logic in React. Render server outcomes intentionally and preserve the encryption/watermark/sanitization pipeline.

---

## 2. Auth

Backend area: `src/auth/`

Verified capabilities include:
- registration;
- login;
- current-user/session fetch;
- email verification / OTP;
- resend verification;
- forgot/reset password;
- logout;
- JWT authentication;
- Google/OAuth-related infrastructure in the backend tree.

### Current frontend
Core email/password auth flows are already reconstructed.

### Future checks
When auth/settings are revisited, audit current OAuth/session/security behavior in canonical backend rather than relying on historical docs.

---

## 3. Users / profile / preferences / privacy

Backend area: `src/users/`

Current backend exposes user/profile-related operations and statistics/preferences/privacy/account functionality.

### Frontend opportunities
- Settings information architecture;
- profile editing;
- preferences;
- password/security flows;
- privacy/account controls;
- home/streak/activity presentation where appropriate.

### Authority
Backend owns user mutations, security validation and privacy/account rules.

---

## 4. QBank / tests / exam engine

Backend area: `src/tests/`

This is one of the most mature backend domains and is split into dedicated services for creation, execution, retrieval, metadata, analytics, AI, block generation, question search and aggregation.

Verified controller capabilities include:
- question counts and mixed-mode counts;
- test creation;
- user's tests;
- question search;
- single-question practice;
- full test retrieval;
- test deletion and rename;
- imported/UWorld ID retrieval;
- per-answer submission;
- timed atomic batch submission;
- persisted highlights;
- persisted mark-for-review;
- lazy explanation retrieval;
- AI explanations and cache check;
- complete;
- suspend;
- resume;
- feedback;
- metadata endpoints (subjects/systems/topics/difficulty/question banks/main banks);
- performance overview/statistics/results.

Security/access behavior includes JWT, content-security, test-access guards and server-side watermarking of question/option/explanation HTML.

### Current frontend
- QBank discovery/workspace/Create Test/Previous Tests substantially reconstructed;
- Exam Runner/results still missing/placeholder.

### Frontend rule
Do not reproduce scoring, selection, access, correctness or timed completion semantics client-side. The runner orchestrates the server contract.

---

## 5. Library

Backend area: `src/library/`

Verified capabilities include:
- structure by source;
- external-caller resolution;
- article retrieval with quota/security/watermarking;
- mark read;
- bookmark toggle and bookmark state;
- persistent article highlights;
- tooltips;
- article search;
- cached AI summaries;
- AI summary generation/regeneration with global and per-user quota logic;
- admin/library management paths in the backend tree.

### Current frontend
Library is the most advanced recovered frontend area: article reader, search, annotation/highlight tools, notebook drawer, AI summary, Amboss-style UI behavior, image tooling, split view, dark mode and High-yield behavior.

### Frontend rule
Keep AI quota/subscription decisions on the backend. Treat content HTML as untrusted and sanitize it while preserving server watermarking.

---

## 6. Notebook and question notes

Backend areas:
- `src/notebook/`
- `src/notes/`

Verified capabilities include notebook CRUD plus question-specific notes/search and linked-question functionality.

### Frontend design question
The product has two related persistence models. Before exposing both broadly, define a clear user mental model:
- what belongs in a personal notebook;
- what belongs as a question note;
- how/if they cross-link;
- where each appears in Exam Runner, Library and standalone study areas.

Do not merge the persistence models in React without a deliberate backend/product decision.

---

## 7. Flashcards / spaced repetition

Backend area: `src/flashcards/`

Verified capabilities include:
- deck CRUD/listing;
- flashcard CRUD/list/search;
- question-linked flashcards;
- append/update card content;
- deck study session start/resume;
- per-card study state;
- spaced-repetition rating;
- bury;
- suspend/unsuspend;
- reschedule;
- export (including Anki/APKG path in backend history/current feature set).

### Frontend opportunities
- deck library;
- deck/card editor;
- create card from question/explanation;
- focused study session;
- scheduling/status views;
- export.

### Rule
Scheduling algorithms and study-state transitions stay backend-owned.

---

## 8. Revision

Backend area: `src/revision/`

Verified capabilities include:
- revision overview by QBank;
- active session lookup by QBank/subject/system;
- session creation;
- session retrieval;
- progress update;
- completion;
- completed-history deletion.

### Frontend opportunity
A structured marked-question/revision workflow can be built later without inventing a new persistence model.

---

## 9. Analytics / activity / streaks / badges

Relevant backend areas/entities/services include:
- test analytics and aggregation;
- analytics snapshots;
- user analytics rollups;
- dimension statistics;
- daily statistics/activity;
- streak fields/calculation;
- badges/admin badge support;
- activity logging.

### Frontend opportunity
Performance dashboards, trends, weakness views, streak/goals/badges and AI-Analyst-like experiences.

### Rule
Every displayed metric needs a documented canonical source and semantic definition. Do not re-derive canonical metrics differently in React.

---

## 10. Subscription, pricing, access and payments

Backend area: `src/subscriptions/` plus related payment/finance modules.

The backend tree includes:
- subscription/access services/controllers;
- pricing plans;
- manual payment paths;
- admin subscription/payment/settings controllers;
- support-role payment operations;
- subscription/access guards and data on users.

### Frontend opportunities
- subscription/access status;
- pricing/plans;
- upgrade/payment workflow if still desired;
- entitlement/locked states;
- account subscription management.

### Rule
Never infer premium/step access solely from UI state. Backend is authoritative.

---

## 11. Contests

Backend area: `src/contests/`

The canonical backend contains a substantive contest domain and lifecycle rather than a simple placeholder API.

### Frontend opportunity
A full contest product may include discovery, registration/status, competition flow and results/ranking depending on the currently intended product scope.

### Design gate
Re-audit the current controller/service contract when Contests becomes active; do not blindly recreate an old frontend or expose every backend operation.

---

## 12. Messages / conversations

Backend area: `src/messages/`

Verified capabilities include:
- send message;
- conversations/inbox;
- history with another user;
- mark read.

### Frontend opportunity
Only build messaging if it remains an approved product surface. Treat privacy/abuse/access behavior as backend concerns and verify before release.

---

## 13. Tickets / support

Backend area: `src/tickets/` plus `src/support/`.

Verified current ticket controller uses user-scoped service operations for reading/updating/deleting a user's ticket and supports user messages.

The backend also contains a dedicated support-role workspace/service layer.

### Important historical note
An older security audit reported ticket ownership/IDOR concerns. Current canonical controller paths have changed and must be evaluated as current code, so the old report is a re-check item—not proof of a present vulnerability.

---

## 14. Settings / application settings / maintenance

Backend areas include `src/settings/` and maintenance-related infrastructure.

### Frontend/admin opportunities
- user-facing settings only where exposed through user contracts;
- admin application settings where role-authorized;
- maintenance UX driven by backend behavior.

Do not expose internal settings merely because an admin endpoint exists.

---

## 15. Careers

Backend area: `src/careers/`

The tree includes public/user and admin careers/job functionality.

### Frontend opportunity
Public jobs/careers and applications if this remains part of the current MedPark product scope; admin management later.

---

## 16. Admin content/operations

Backend area: `src/admin/` plus domain admin controllers.

The backend tree includes operational capabilities around areas such as:
- users/admin notes;
- questions/content/question groupings;
- AI-related administration;
- lab values;
- coupons;
- expenses;
- notifications;
- badges;
- signup sources;
- gates/OTP/security-related administration;
- library/content administration;
- subscription/payment administration.

### Frontend rule
Admin is a separate UX/workspace design problem. Do not scatter admin buttons through learner pages.

---

## 17. Finance / wallets / payroll / expenses

Backend area: `src/finance/` and related entities/services.

The backend includes finance settings, wallet/ledger/payroll/expense-related capabilities.

### Frontend rule
Treat as privileged operational surfaces with explicit role checks and separate specs. Never surface raw financial/admin data in learner routes.

---

## 18. Affiliate / coupons / acquisition

Backend areas include affiliate and coupon-related services/controllers plus signup-source tracking.

### Frontend opportunity
Only expose approved referral/affiliate/commercial experiences; admin/acquisition surfaces belong in operational specs.

---

## 19. Lab values and media

Backend includes lab-value and media/proxy functionality used by medical content/exam experiences.

### Frontend opportunity
Reference ranges/lab tools and content media should reuse these contracts where relevant rather than embedding a second dataset into the frontend.

---

## 20. Health / monitoring / operational security

Backend includes health/database-monitoring and substantial security infrastructure.

### Frontend implication
Most of this is operational/admin, not learner UI. If surfaced, use tightly scoped role-authorized operational pages rather than public diagnostics.

---

# Capability activation rule

The existence of a backend module is **not** an instruction to build its frontend immediately.

When a capability becomes active:

1. inspect the exact current controller/DTO/service/entity paths in `medhvgg/main`;
2. identify the minimum product scope;
3. discuss UX/style with the user;
4. write/approve the page spec;
5. implement an issue-scoped frontend contract and UI;
6. verify access/error/security states;
7. update this map only if the backend capability itself materially changed.
