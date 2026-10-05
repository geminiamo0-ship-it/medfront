# V2 Release — Deployment Guide

**Feature:** Per-bank subject/system **column ordering** on the Create Test page.

A bank can now pin an exact 2-column left/right layout (and order) for its
subjects and systems, independent of the global `Subject.displayOrder` /
`System.displayOrder` (which is shared across every bank and can't express a
per-bank layout). This release ships the override tables, the runtime logic,
the frontend rendering, and a **seed** that loads the layout for **UWORLD_S1**.

Behaviour changes **only** for a single selected bank that has override rows —
today that is **only UWORLD_S1 (id 19)**. Every other bank / multi-bank / no-bank
selection is byte-for-byte unchanged.

---

## What's in this release

### Backend (`MedPark-Backend`)
| File | Type | Purpose |
|------|------|---------|
| `src/entities/question-bank-subject-order.entity.ts` | new | Subject override table entity |
| `src/entities/question-bank-system-order.entity.ts` | new | System override table entity |
| `src/migrations/1803000000025-AddPerBankSubjectSystemOrder.ts` | new | Creates both tables — **schema only, no data** |
| `src/scripts/seed-uworld-s1-order.ts` | new | **Seed** — loads the UWORLD_S1 layout (see below) |
| `UWORLD_S1_reorder.json` | new | Seed input — desired column order, by name |
| `src/tests/services/test-metadata.service.ts` | edit | `loadOrderOverride` + `applyOrderOverride`, wired into `getSubjects` / `getSystemsWithTopics` |
| `src/tests/tests.module.ts` | edit | Register both repos (`forFeature`) — DI |
| `src/app.module.ts` | edit | Register both entities in root `entities[]` — **runtime metadata** |
| `package.json` | edit | Adds `seed:uworld-s1-order` script |

> ⚠️ **Both** `tests.module.ts` (`forFeature`) **and** `app.module.ts` (`entities[]`)
> registrations are required. `forFeature` alone makes the repo injectable but
> the DataSource has no metadata → **runtime** `EntityMetadataNotFoundError` 500
> on `/tests/metadata/subjects` and `/systems-with-topics`, even though the
> build passes. This is already fixed in this release; just don't drop it.

### Frontend (`MedPark-Frontend`)
| File | Purpose |
|------|---------|
| `src/utils/api.ts` | Adds `columnIndex?` to the subjects/systems response types |
| `src/pages/dashboard/CreateTestPage.tsx` | Renders 2 explicit columns when `columnIndex` is present; else the old split |
| `src/pages/dashboard/CreateTestPage.css` | Page-unique `.subjects-columns` + mobile 1-col collapse |

---

## Deploy order (IMPORTANT)

```
1. Backend: run migration   (creates the two empty tables)
2. Backend: deploy + restart (new code + entity registration)
3. Backend: run the SEED     (fills UWORLD_S1 rows)
4. Frontend: deploy
```

Why this order:
- The new backend code queries the override tables, so the **tables must exist
  first** (step 1) or the query errors with `relation ... does not exist`.
- Between steps 2 and 3 the tables exist but are empty → `loadOrderOverride`
  returns an empty map → global order, no `columnIndex` → **safe**, just no
  reorder yet.
- The frontend falls back to the old layout when no `columnIndex` is sent, so
  its deploy order is not critical — but you only **see** the new layout once
  the backend is live **and** the seed has run.

---

## 1. Backend — run the migration

Schema-only migration `1803000000025-AddPerBankSubjectSystemOrder`. Creates
`question_bank_subject_order` and `question_bank_system_order` (composite PK on
`(question_bank_id, {subject|system}_id)`, `column_index` smallint, `position`
int, index on `question_bank_id`). `CREATE TABLE IF NOT EXISTS` — safe to re-run.

**Production** (compiled, against `dist`):
```bash
npm run migration:run
```

**Dev / local** (the `migration:run:dev` npm script has a Windows trailing-space
bug — run the CLI directly in PowerShell):
```powershell
$env:TYPEORM_ENTITIES='ts'; npx typeorm-ts-node-commonjs migration:run -d src/config/typeorm.config.ts
```

Confirm: `AddPerBankSubjectSystemOrder1803000000025 has been executed successfully.`

## 2. Backend — deploy + restart

Deploy the new backend build and **restart the process**. The restart is what
loads the two new entities into the runtime DataSource (`app.module.ts`
`entities[]`). Without a restart, a running instance keeps the old metadata and
still 500s.

## 3. Backend — run the seed ⭐

**File:** `src/scripts/seed-uworld-s1-order.ts`
**Input:** `UWORLD_S1_reorder.json` (repo root) — subjects + systems, each split
into `column_1` (left) / `column_2` (right), by **name**, in display order.
**Command:**
```bash
npm run seed:uworld-s1-order
```
> Runs against whatever DB the process `.env` (`DB_HOST/PORT/USERNAME/PASSWORD/DATABASE`)
> points at. For production, run it in the prod environment (prod DB creds) — it
> resolves names against **that** DB's ids, so prod subject/system ids are used.

**What the seed does:**
1. Finds the bank by `code = 'UWORLD_S1'` → its id.
2. Loads the bank's **active taxonomy** (subjects/systems actually used by the
   bank's questions) and builds a name→id index **scoped to the bank** — this
   dodges case-insensitive duplicate names elsewhere in the global tables
   (e.g. "Dermatology" vs "DERMATOLOGY").
3. Resolves each JSON name to an id and records `(id, column_index 1|2,
   position)`.
4. In **one transaction**: deletes the bank's existing override rows, then
   inserts the resolved rows. Delete-then-insert = true **replace**, so editing
   the JSON (removing/moving a name) is reflected and re-running is safe.
5. Prints a report — matched counts, `replaced N → M`, unmatched names,
   ambiguous names, coverage gaps.

**Expected output (current data):**
```
Bank "UWORLD_S1" → id 19 (step 1)
Subjects: matched 13/13 JSON entries → replaced 13 prior row(s) with 13.
Systems:  matched 26/26 JSON entries → replaced 26 prior row(s) with 26.
── UNMATCHED JSON NAMES ──   (none)
── AMBIGUOUS NAMES ──        (none)
── COVERAGE GAPS ──          (none)
```

**Idempotent** — safe to re-run any time. It only writes the two override
tables; it never modifies questions/subjects/systems.

**To change the layout later:** edit `UWORLD_S1_reorder.json` and re-run the
seed. Names must match the bank's taxonomy exactly (case-insensitive). Any
**UNMATCHED** name in the report means the JSON name has no matching
subject/system in that bank — fix the JSON (or the DB) and re-run. Any
**COVERAGE GAP** means a subject/system in the bank isn't listed in the JSON;
it falls back to global order (appended after the pinned column-1 items).

## 4. Frontend — deploy

Standard build + deploy:
```bash
npm run build
```
No env or config changes. Falls back to the previous layout for any bank
without an override.

---

## Verification (post-deploy)

1. Open Create Test for **UWORLD_S1 (step 1)**. Subjects show 2 columns (7 left
   / 6 right), systems show **16 left / 10 right** in the JSON order.
2. Open Create Test for **any other bank** → unchanged (old layout).
3. Backend logs: no `EntityMetadataNotFoundError` on `/tests/metadata/subjects`
   or `/systems-with-topics`.
4. Optional DB check:
   ```sql
   SELECT column_index, COUNT(*) FROM question_bank_subject_order WHERE question_bank_id = 19 GROUP BY 1;  -- 1→7, 2→6
   SELECT column_index, COUNT(*) FROM question_bank_system_order  WHERE question_bank_id = 19 GROUP BY 1;  -- 1→16, 2→10
   ```

---

## Rollback

- **Data only** (keep the tables, drop the layout):
  ```sql
  DELETE FROM question_bank_subject_order WHERE question_bank_id = 19;
  DELETE FROM question_bank_system_order  WHERE question_bank_id = 19;
  ```
  The UI immediately reverts UWORLD_S1 to the global order (no code change).
- **Full schema rollback** (removes the feature's tables):
  ```bash
  npm run migration:revert    # reverts 1803000000025 (down() drops both tables)
  ```
  Revert the app code alongside it, since the runtime references the entities.

---

## Notes / gotchas

- The override applies **only** when exactly one bank is selected. The Create
  Test page is always scoped to one bank, so this always holds there.
- The shared 24h systems cache is **not** mutated — the override is applied to
  fresh in-memory copies per request.
- Mode and difficulty filters are unaffected — they filter counts; the override
  only re-sorts.
- Adding a **new** bank layout later = add its `code` handling / JSON and reuse
  the same tables; no new migration needed (the schema is generic).
