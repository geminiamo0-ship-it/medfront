# MRCP & Library Production Deployment Guide

Follow these steps to deploy the MRCP Passmedicine integration to production, ensuring data integrity and cache coherence.

## 1. Run Migrations

Deploy the updated backend code and run your standard production migration command:
```bash
npm run migration:run
```

This will run the following migrations:
- **AddLibrarySource** — Adds `librarySource` to `main_banks` and `librarySourceSnapshot` to `tests`
- **AddLibraryArticleColumns** — Adds `external_caller` and `library_name` columns to `library_articles`, deduplicates existing rows, and adds a unique index on `(source, name, category)`

> **⚠️ Important**: Before running the migration on dev/prod, deduplicate any existing `library_articles` rows that share the same `(source, name, category)`:
> ```sql
> DELETE FROM library_articles a
> USING library_articles b
> WHERE a.source = b.source
>   AND a.name = b.name
>   AND a.category = b.category
>   AND a.id < b.id;
> ```

## 2. Configure Main Banks

Set the `library_source` column on each main bank to control which library loads for tests:

```sql
-- Passmedicine banks
UPDATE main_banks SET "librarySource" = 'passmedicine' WHERE id IN (14, 15);

-- Pastest banks
UPDATE main_banks SET "librarySource" = 'pastest' WHERE id IN (17, 19);

-- USMLE banks (UWorld, Amboss, etc.)
UPDATE main_banks SET "librarySource" = 'usmle' WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);
```

> Adjust the IDs to match your production data. Banks without a `librarySource` value will default to `'all'`.

## 3. Import Data

Make sure the SQLite databases are available on your production server in their `all_db/` subfolders.

### Question Banks

**Import MRCP Part 1:**
```bash
npm run import:mrcp1 -- --skip-existing
```

**Import MRCP Part 2:**
```bash
npm run import:mrcp2 -- --skip-existing
```

### Libraries

**Import Pastest Library Part 1** (source=`pastest`, 649 articles):
```bash
npm run import:pastest-library -- --skip-existing
```

**Import Pastest Library Part 2** (source=`pastest_2`):
```bash
npm run import:pastest-library-2 -- --skip-existing
```

**Import Passmedicine Library** (source=`passmedicine`):
```bash
npm run import:passmedicine-library -- --skip-existing
```

**Import Amboss Library** (if needed):
```bash
npm run import:amboss-library -- --skip-existing
```

**Import USMLE Library** (if needed):
```bash
npm run import:library-articles -- --skip-existing
```

> Re-running any library import is safe — the scripts upsert using `(source, name, category)` as the dedup key.

## 4. Cache Invalidation

Clear the library structure cache in Redis so new articles are visible:

**Option A: Flush Redis (Recommended)**
```bash
redis-cli FLUSHALL
```

**Option B: Delete Specific Keys**
```bash
redis-cli DEL "medpark:static_library:structure:usmle"
redis-cli DEL "medpark:static_library:structure:amboss"
redis-cli DEL "medpark:static_library:structure:passmedicine"
redis-cli DEL "medpark:static_library:structure:pastest"
```
*(Ensure the `medpark:` prefix matches your `REDIS_PREFIX` environment variable).*

**Frontend Cache:**
The frontend holds an in-memory cache for 5 minutes. If you verify the data but still see stale content, perform a **Hard Refresh** (`Ctrl+F5`).

## 5. Verification

After deployment, verify:

1. **Library articles exist** — Check that all 4 sources have articles:
   ```sql
   SELECT source, COUNT(*) FROM library_articles GROUP BY source;
   ```

2. **Test creation snapshots** — Create a test from a Pastest bank and verify the test gets `librarySourceSnapshot = 'pastest'`.

3. **Library panel** — Open a test and check that the library sidebar shows the correct library name (e.g., "Pastest Library") and loads the correct articles.

4. **Deep links** — Click a library link in a question explanation and verify it opens the correct article in the sidebar.

---

# Phase 2 — One Exam (MRCP Part 1) + Passmedicine Part 2 / Diagrams / Index

This phase imports the `all_db/` databases added in June 2026. Each library gets its **own** source (a main bank loads exactly one source for its in-test sidebar). Source values are lowercase slugs — the library service lowercases the source on every read, so the stored value must be lowercase.

| Source DB (after folder prep) | Type | What it is | source |
|---|---|---|---|
| `all_db/mrcp p 1/one_exam/` | Question bank (3,406 Q) | **New** "One Exam" bank **under** the MRCP Passmedicine 1 main bank | — |
| `all_db/mrcp p 2/` | Question bank (2,901 Q) | **Update** to the existing MRCP Passmedicine 2 bank (edits + deep-links) | — |
| `all_db/one exam library/` | Library (1,012) | Browse library for the One Exam bank | `1exam_notes` |
| `all_db/pass med library part2/` | Library (1,068) | Deep-link target for MRCP Part 2 questions | `pm_library_part_2` |
| `all_db/pass med digram library/` | Library (32) | Passmedicine diagrams (browse-only) | `pm_diagrams` |
| `all_db/passmed index library/` | Library (576) | Passmedicine extended index (browse-only) | `pm_index` |

## 0. Pre-flight (REQUIRED)

Deploy the updated backend code and run migrations **before importing**:
```bash
npm run migration:run
```
The library importer upserts with `ON CONFLICT (source, name)`, which requires the `IDX_library_articles_source_name` unique index from migration `1800000000000-UpdateLibraryArticleUniqueIndex`. If it isn't applied, **every library import batch fails** ("no unique or exclusion constraint matching the ON CONFLICT specification") and imports 0 rows.

## 1. Prepare the SQLite folders

`import-step.ts` scans fixed roots `all_db/mrcp p 1/` and `all_db/mrcp p 2/` and reads the bank DB **directly** at `<root>/my_course_bank.db`.

- **MRCP Part 2 (update):** rename `mrcp part 2` → `mrcp p 2`, and **move the DB up** to `all_db/mrcp p 2/my_course_bank.db` (out of the `passmed part2/` subfolder). This lands on the existing `MRCP_PART_2` bank.
- **MRCP Part 1 (One Exam):** rename `mrcp part 1` → `mrcp p 1`, **keep** the `one_exam/` subfolder. The `FOLDER_TO_MAIN_BANK["one_exam"]` entry in `import-step.ts` discovers `all_db/mrcp p 1/one_exam/my_course_bank.db` and imports it as its **own provider / main bank "One Exam"** (code `ONEXAM_S4`) — a separate card in the MRCP Part 1 track alongside MRCP Passmedicine 1, Pastest and Past Papers. The question bank keeps code `MRCP_PART_1_ONE_EXAM` (so a re-import re-links the existing row to this main bank instead of duplicating it, and keeps the MRCP viewer theme via the prefix).

## 2. Import question banks

```bash
# One Exam — its OWN provider/bank in the MRCP Part 1 track (skip-existing is fine, all new)
npm run import:mrcp1 -- --skip-existing

# MRCP Part 2 — UPDATE. Run WITHOUT --skip-existing so edited questions and the
# data-lxid → data-external_caller deep-link rewrite are applied to existing rows.
npm run import:mrcp2
```
> ⚠️ Do **not** pass `--skip-existing` to the Part 2 import — it would skip every already-present question and drop all the edits/deep-links.

## 3. Import libraries

Each library has its own source (run order is independent):
```bash
npm run import:one-exam-library        # source=1exam_notes
npm run import:passmed-library-part2   # source=pm_library_part_2  (Part 2 deep-link target)
npm run import:passmed-diagram-library # source=pm_diagrams
npm run import:passmed-index-library   # source=pm_index
```
> Because each library is its own source, there is **no** cross-library overwrite — the `(source, name)` upsert key is unique per source. Re-running any import is idempotent.

## 4. Configure main banks (by `code`, not id)

```sql
-- MRCP Part 2 → its own Part-2 library (matches the questions' deep-link source)
UPDATE main_banks SET "librarySource" = 'pm_library_part_2' WHERE code = 'MRCP_PART_2';
-- One Exam (its own provider) → its own 1exam Notes library
UPDATE main_banks SET "librarySource" = '1exam_notes'       WHERE code = 'ONEXAM_S4';
-- MRCP Passmedicine 1 (unchanged) → passmedicine
UPDATE main_banks SET "librarySource" = 'passmedicine'      WHERE code = 'MRCP_PART_1';
```

> **One Exam** is its **own** main bank (provider card `ONEXAM_S4`) in the MRCP Part 1 track, with `librarySource = '1exam_notes'` so its tests show the 1exam Notes library in the in-test panel. (One Exam questions carry no in-text deep-links, so the source only drives the browse panel.)
>
> **Diagrams / Index** are browse-only sources (no question bank deep-links into them), surfaced through their dashboard library pages — no `main_banks` row points at them.

## 5. Frontend

Redeploy the frontend. This phase adds four dashboard library pages + menu items and in-test panel titles:

| Menu item | Route | source |
|---|---|---|
| PM Library Part 2 | `/dashboard/pm2-library` | `pm_library_part_2` |
| PM Diagrams | `/dashboard/pm-diagrams` | `pm_diagrams` |
| PM Index | `/dashboard/pm-index` | `pm_index` |
| 1exam Notes | `/dashboard/oe-library` | `1exam_notes` |

## 6. Cache invalidation

```bash
redis-cli FLUSHALL
# or delete the affected structure keys (match your REDIS_PREFIX):
redis-cli DEL "medpark:static_library:structure:pm_library_part_2"
redis-cli DEL "medpark:static_library:structure:pm_diagrams"
redis-cli DEL "medpark:static_library:structure:pm_index"
redis-cli DEL "medpark:static_library:structure:1exam_notes"
```

## 7. Verification

```sql
SELECT source, COUNT(*) FROM library_articles GROUP BY source;
-- expect: 1exam_notes ≈ 1012, pm_library_part_2 ≈ 1068, pm_diagrams ≈ 32, pm_index ≈ 576
```
- **One Exam** appears as a selectable bank under MRCP Passmedicine 1 with 3,406 questions.
- **MRCP Part 2** question count reflects the update; open a Part 2 question's in-text deep link → it resolves to a Part 2 article, no 404. (Measured: 924/924 Part 2 deep-links map to the Part 2 library.)
- **PM Library Part 2 / PM Diagrams / PM Index / 1exam Notes** appear in the dashboard sidebar and load articles.

---

# Phase 3 — One Exam (MRCP Part 2)

Adds the **One Exam** provider's **Part 2** question bank, dropped in `all_db/` (July 2026). Mirrors the Phase-2 One Exam (Part 1) setup, but in the MRCP Part 2 track and as its **own** provider card.

| Source DB (after folder prep) | Type | What it is | source |
|---|---|---|---|
| `all_db/mrcp p 2/1exam part2/` | Question bank (1,827 Q) | **New** "One Exam" bank as its OWN main bank in the MRCP Part 2 track | — |

- Main bank: **`ONEXAM2_S5`** → card **"1exam - MRCP Passmedicine 2"** (a 4th card in the Part 2 track, alongside MRCP Passmedicine 2, Pastest, Past Papers).
- Question bank: **`MRCP_PART_2_ONE_EXAM`**, step 5, viewer theme `mrcp_passmedicine` (resolved from the `MRCP_PART_2` code prefix — no code change).
- No library in this drop (One Exam questions carry no in-text deep-links). `librarySource` config is **optional** — see step 3.

> **Note on the main-bank code:** Part 1 One Exam uses `ONEXAM` (`ONEXAM_S4`); Part 2 uses **`ONEXAM2`** (`ONEXAM2_S5`) — set via `FOLDER_TO_MAIN_BANK["1exam_part2"]` in `import-step.ts`. If you'd rather keep the provider code symmetric, change that def's `code` to `ONEXAM` (→ `ONEXAM_S5`) before importing.

## 0. Pre-flight (REQUIRED)

Deploy the updated backend code first. This phase needs **no new migration** — it reuses the existing schema. It DOES need the `import-step.ts` changes:
- `FOLDER_TO_MAIN_BANK["1exam_part2"]` — maps the `1exam part2` subfolder to the One Exam Part 2 main bank (`ONEXAM2`) + question bank (`MRCP_PART_2_ONE_EXAM`).
- `resolveStepDir` — the step-2 scan now accepts **both** `mrcp p 2` and `mrcp part 2` on disk.

## 1. Prepare the SQLite folder

Place the DB at either path (both are discovered — canonical `mrcp p 2` is tried first, `mrcp part 2` is accepted as a fallback):
```
all_db/mrcp p 2/1exam part2/my_course_bank.db      # canonical
all_db/mrcp part 2/1exam part2/my_course_bank.db   # also works (no rename needed)
```
`import-step.ts` discovers the `1exam part2` subfolder (normalized key `1exam_part2`) and imports it as its own provider — the question bank keeps code `MRCP_PART_2_ONE_EXAM` so a re-import re-links the existing row (no duplicate).

## 2. Import the question bank

The Part 2 scan imports the MRCP Passmedicine 2 root update **and** any provider subfolders (One Exam Part 2) in one pass:
```bash
npm run import:mrcp2
```
> ⚠️ Same rule as Phase 2: run **without** `--skip-existing` so the Passmedicine 2 root update applies its edits/deep-links. One Exam Part 2 is all-new, so it imports fully either way.
>
> To import **only** One Exam Part 2 (e.g. Passmedicine 2 root not present in this drop), the same command still works — it just reports "Root database not found, continuing to subdirectories" and imports the subfolder.

## 3. Configure main bank (optional)

One Exam questions have **no** in-text deep-links, so `librarySource` only drives the in-test browse panel. Default (unset) → `'all'`.
```sql
-- OPTIONAL: only if One Exam Part 2 tests should show a browse library in-test.
-- Reuse the Part 1 notes library, or a Part-2 library if/when one is imported.
UPDATE main_banks SET "librarySource" = '1exam_notes' WHERE code = 'ONEXAM2_S5';
```
> Skip this step to leave the in-test library panel at its default. No `library_articles` import is part of this phase.

## 4. Cache invalidation

```bash
redis-cli FLUSHALL
```
(No library sources changed, so only the bank/taxonomy caches matter; a full flush is simplest.)

## 5. Verification

```sql
-- Bank + link
SELECT qb.code, qb.step, mb.code AS main_bank, qb."totalQuestions"
FROM question_banks qb JOIN main_banks mb ON mb.id = qb."mainBankId"
WHERE qb.code = 'MRCP_PART_2_ONE_EXAM';
-- expect: MRCP_PART_2_ONE_EXAM | 5 | ONEXAM2_S5 | 1827

-- Data integrity
SELECT
  (SELECT COUNT(*) FROM questions WHERE "questionBankId" = qb.id) AS questions,   -- 1827
  (SELECT COUNT(*) FROM question_options o JOIN questions q ON q.id = o."questionId" WHERE q."questionBankId" = qb.id) AS options  -- 9135
FROM question_banks qb WHERE qb.code = 'MRCP_PART_2_ONE_EXAM';
```
- **1exam - MRCP Passmedicine 2** appears as a 4th selectable card in the MRCP Part 2 (step 5) track with **1,827** questions.
- Options total **9,135** (5 per question); **0** questions missing a correct option.
- Open a One Exam Part 2 question → renders in the Passmedicine viewer theme.
