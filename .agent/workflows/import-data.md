---
description: How to import all question bank and library data into the database
---

# MedPark Data Import Guide

Run all commands from: `c:\Users\shady\OneDrive\Desktop\MedPark\MedPark-Backend`

## Prerequisites

- PostgreSQL database is running and connected
- Redis is running
- `.env` file is configured with correct DB credentials
- All SQLite source files are in the `all_db/` folder with the correct structure (see below)

---

## Folder Structure Required

```
all_db/
├── step1/
│   ├── uworld/          → UWorld Step 1
│   ├── amboss/          → TheBoss (Amboss) Step 1
│   ├── mehlman/         → Mehlman Step 1
│   ├── nbme/
│   │   ├── 1/           → NBME 1 (Step 1)
│   │   ├── 4/           → NBME 4 (Step 1)
│   │   └── .../
│   └── cms/             → CMS Step 1
├── step2/
│   ├── uworld/
│   │   ├── my_course_bank.db
│   │   └── Self-Assessments-Step 2/
│   │       ├── 1/
│   │       └── 2/
│   ├── amboss/
│   ├── mehlman/
│   └── nbme/
│       ├── 10/
│       └── .../
├── step3/
│   ├── uworld/
│   │   ├── my_course_bank.db
│   │   └── Self-Assessments-Step 3/
│   │       ├── 1/
│   │       └── 2/
│   ├── amboss/
│   ├── mehlman/
│   └── nbme/
│       ├── 1/
│       └── 2/
└── Library/
    └── my_course_bank.db   → Library articles (library_articles table)
```

Each folder must contain a `my_course_bank.db` SQLite file with:
- `questions` table: `id, uworld_id, text_html, explanation_html, subject, system, topic`
- `options` table: `id, question_id, text_html, is_correct`

The Library DB must contain:
- `library_articles` table: `id, uworld_id, title, body_html, qbank, created_at`

---

## Import Commands

### Step 1 — Import Step 1 Question Banks
```bash
npm run import:step1
```

### Step 2 — Import Step 2 Question Banks
```bash
npm run import:step2
```

### Step 3 — Import Step 3 Question Banks
```bash
npm run import:step3
```

### MRCP Part 1 — Import Question Banks
```bash
npm run import:mrcp1
```

### MRCP Part 2 — Import Question Banks
```bash
npm run import:mrcp2
```

### Library Articles — Import Medical Library
```bash
npm run import:library-articles
```

### Pastest Library — Import Pastest Library Articles
```bash
npm run import:pastest-library
```

### Pastest Library Part 2 — Import Pastest Library Articles Part 2
```bash
npm run import:pastest-library-2
```

> ⚠️ The library importer automatically:
> - Cleans up any bad rows (name = 'Untitled Article')
> - Skips articles already in the DB (idempotent)
> - Batch inserts 100 articles at a time

---

## Full Production Import (run in order)

```bash
npm run import:step1
npm run import:step2
npm run import:step3
npm run import:library-articles
```

> ✅ All commands are **idempotent** — safe to re-run if interrupted. Existing records are skipped.

---

## Dry Run (check without writing)

```bash
npm run import:step1 -- --dry-run
npm run import:step2 -- --dry-run
npm run import:step3 -- --dry-run
```

---

## Force Re-import (skip de-duplication check)

```bash
npm run import:step1 -- --no-skip
npm run import:step2 -- --no-skip
npm run import:step3 -- --no-skip
```

---

## What Each Script Does

| Command | Script | Target Table |
|---|---|---|
| `import:step1` | `src/scripts/import-step.ts --step=1` | `questions`, `question_options`, `question_banks`, `main_banks` |
| `import:step2` | `src/scripts/import-step.ts --step=2` | `questions`, `question_options`, `question_banks`, `main_banks` |
| `import:step3` | `src/scripts/import-step.ts --step=3` | `questions`, `question_options`, `question_banks`, `main_banks` |
| `import:library-articles` | `src/scripts/import-library-articles.ts` | `library_articles` |

---

## Troubleshooting

### "Unknown main bank folder" warning
The SQLite folder name doesn't match the expected mapping. Rename the folder to match:
- `uworld`, `amboss`, `mehlman`, `nbme`, `cms`, `pass-medicine`, `library`

### "No databases found"
Check that there is a `.db` file inside each bank folder.

### Banks show 0 questions after import
The SQLite `questions` table may be empty or the table schema is different. Run:
```bash
node --require ts-node/register --require tsconfig-paths/register src/scripts/inspect-db.ts all_db/<path>/<bank>/my_course_bank.db library_articles
```

### "Untitled Article" rows in library
The script automatically cleans these up on re-run. You can also clear manually:
```sql
DELETE FROM library_articles WHERE name = 'Untitled Article' OR trim(name) = '';
```
