# Features — Create Test

Route: `/qbank/:bankId/create-test` · File: `src/pages/qbank/CreateTestPage.tsx`

Built to mirror the UWorld test-creation screen: pick question modes, difficulty, subjects, systems and topics, choose a size and test type, then create.

## Question Mode header

Shows **QUESTION MODE** with a **Total Available** pill (count from `/tests/counts`) and a **Standard | Custom** segmented toggle.

## Standard tab

### Question modes (multi-select)

Each mode is a checkbox with its count. The list mirrors the backend `TestMode` enum:

`all` · `unused` · `used` · `incorrect` · `correct` · `marked` · `marked_correct` · `marked_incorrect` · `omitted` · `suspended`

- Single selection → availability comes from `/tests/counts`.
- Multiple selections → `/tests/counts/mixed` (intersection semantics).
- Availability recomputes on every filter change; unknown counts render as `—`.

### Difficulty

Tier checkboxes with counts from `/tests/metadata/difficulty-counts`: `very_hard` · `hard` · `medium` · `easy` · `very_easy`.

### Subjects

Two-column matrix: checkbox, subject name, question count, plus a select-all checkbox with an indeterminate state. Subjects come from `/tests/metadata/subjects`.

### Systems (gated by subjects)

Two-column matrix of systems with question counts and a `+` / `−` expander revealing that system's topics and their counts, from `/tests/metadata/systems-with-topics`.

**Gating rule:** while no subject is selected the systems block is disabled/dashed and shows *"Select at least one subject to unlock systems and their topics."* Counts are discounted by the selected subjects, so the numbers update as subjects change. A select-all checkbox with indeterminate state sits above the systems grid.

### Topic search

A **Search Topics** control opens a popover listing every topic in the bank (merged by name, see below) with its system names and counts. Selections are held as *pending* until **Apply Filter**; **Clear** resets. Applying sets the topic IDs and auto-selects their parent systems.

### Duplicate topic-name merging

Topics with identical names are merged in **both** places:

- the global search popover (149 merged rows, 0 duplicate names in verification)
- the expanded per-system topic lists (176 merged rows, 0 duplicate names)

Merging sums the question counts, joins the source system names, and — crucially — keeps every underlying topic ID in the selection so filtering still targets the right questions.

### Test options

- **Number of questions** (capped by availability)
- **Test type:** Tutor vs Timed
- **Block / End-Block** toggle for form banks
- **Test name** (optional)

## Custom tab

Matches the reference flow:

- **TEST NAME** input (optional)
- Blue instructions box: only unused questions, maximum 50, invalid IDs rejected
- **RETRIEVE QUESTIONS OF A TEST #** — enter an existing test id → `POST /tests/retrieve-questions` fills the ID list, with a status message such as *"Loaded N question IDs from test #X"*
- **OR** divider
- **ENTER UW IDS SEPARATED BY COMMA (,)** textarea with the "does not end with a comma" hint and a live **`N / 50 selected`** counter (turns red past 50)

## Creation payload

```jsonc
{
  "qBankId": 19,
  "type": "tutor",                 // or "timed"
  "mode": "unused",                // single mode, "all" for custom, "mixed_modes" for 2+ modes
  "totalQuestions": 40,
  "name": "Cardio block",
  "isBlock": true,
  "timeLimitSeconds": 3600,        // required for timed (≈90s per question)
  "filters": {
    "modes": ["unused", "incorrect"],
    "difficulty": ["medium", "hard"],
    "subjectIds": [12, 34],
    "systemIds": [5, 9],
    "topicIds": [101, 102],
    "questionBankIds": [19]
  },
  "customQuestionIds": [12518, 4762]
}
```

Server-side rules that shape this payload:

- `mode` is validated with `@IsEnum(TestMode)`; the enum value for multi-mode is **`mixed_modes`** and it requires `filters.modes`.
- Custom tests require `filters.questionBankIds` (otherwise 400 *"Custom tests require selecting a question bank."*), are limited to **unused** questions and capped at **50**.
- Timed tests require `timeLimitSeconds` unless the test is a block.

## Known gaps in this screen

Tracked in [ROADMAP.md](ROADMAP.md):

1. Multi-mode creation currently sends `mode: "mixed"` instead of `"mixed_modes"` → rejected by the API.
2. Custom ID parsing truncates with `.slice(0, 50)`, so extra IDs are dropped silently and the ">50" warning can never appear.
3. The systems query reuses the creation `filters` (including `systemIds` / `topicIds`), so picking a system or topic can shrink the systems matrix and the topic search.
4. Minor polish: duplicate `Link` imports in `WelcomePage`, a `null as unknown as number` cast in the availability query, bank cards respond to Enter but not Space.