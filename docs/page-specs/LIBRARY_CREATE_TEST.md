# Library article → Create Test shortcut — implementation specification

**Issues:** medfront #47; medhvgg #30
**Status:** IMPLEMENTING / VERIFYING
**Route:** `/library?source=amboss` (existing Library article reader)
**User approval:** 2026-10-08 — enable and configure existing Create Test toolbar button without page redesign.

## Purpose and scope

Enable AMBOSS articles to launch a real Tutor/Unused test containing only
questions linked to that specific internal article ID; keep Passmedicine and
Pastest title-to-topic shortcut unchanged. No new screens, no wholesale
Library responsive work, no importer rewrite in this issue.

## UI and interaction

- **Desktop/tablet/mobile:** existing header toolbar slot and styles,
  no new layout or visual redesign. The button becomes visible for AMBOSS.
- Disabled while loading/creating; uses existing toast, navigation and error
  handling. On success navigate to `/dashboard/test/:id`. On an empty
  article, display backend error and remain on Library.
- Backend owns authentication, subscription, quota, source/bank validation and
  actual selection. The frontend may inspect the bank listing only to send
  an explicit bank ID, never to override authorization.
- No automatic switch to another topic, bank or `all` mode on failure.

## API contract

POST `/api/tests`:
```json
{"title":"Article Practice","type":"tutor","mode":"unused","step":1,"totalQuestions":40,"filters":{"articleId":967,"questionBankIds":[1]}}
```
`articleId` is the internal `library_articles.id`, **not** its external
alphanumeric AMBOSS ID. The backend must have applied its idempotent
backfill to `questions.articleId`; otherwise no tests can be created for
unlinked articles. Response: existing created test id.

## States and acceptance criteria

- [ ] Existing AMBOSS article loaded → Create Test visible, accessible button.
- [ ] Button disabled until article content has resolved internal ID.
- [ ] Linked article → only its questions selected; no duplicates.
- [ ] Empty/unmatched article → clear error; no unrelated questions.
- [ ] No entitlement / bad source / rate limit → backend rejects.
- [ ] Existing Passmedicine/Pastest shortcut unchanged.
- [ ] React typecheck, lint, production build and Actions Verify.
- [ ] Browser desktop/mobile and real API production acceptance after backend
      deploy AND controlled migration.
- [ ] Existing Library reading/highlighting/AI/search regression check.

## Deployment / dependencies

Backend PR #31 and one-off runner PR #32 merged. Railway pre-deploy logs
confirmed 2,783/2,785 AMBOSS questions linked, 2 unmatched, and the
command was removed after deployment. Live browser acceptance is still
unverified; keep the feature issue open. Legacy importers must not be
used in production until their raw SQLite article-ID handling is upgraded.

## Approval / verification log

2026-10-08: user explicitly approved implementation and existing toolbar
design. Issue opened. Production runtime verification pending; do not mark
the issue DONE on CI alone.

2026-10-08: Railway verified transaction (2783 linked / 2 intentionally unmatched); predeploy reset. Frontend/browser gates remain open.
