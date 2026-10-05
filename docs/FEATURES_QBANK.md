# Features — QBank

## 1. Bank listing (`/qbank`)

Implemented in `src/pages/QbankPage.tsx`.

1. **Step tabs** across the top (Step 1 / Step 2 / …) — stored in the URL as `?step=N`.
2. **Provider cards** (main banks) from `getMainBanks(step)` — gradient/initials theming comes from `src/pages/qbank/bankTheme.ts`.
3. **Question banks underneath** the selected provider, from `getQuestionBanks(step, mainBankId)`. Each card shows:
   - name + description
   - total questions
   - used progress bar (`used / total`, percent)
   - lock/block badges for form-style banks
4. Clicking a card navigates to `/qbank/:questionBankId?step=N`.

Cards are keyboard accessible (Enter). Loading uses `SectionLoader`, so the page shell and step tabs render while data streams in.

### Live identifiers

Step 1 main banks: `1` Amboss (`Amboss_S1`) · `2` Mehlman (`MEHLMAN_S1`) · `3` NBME (`NBME_S1`) · `4` UWorld (`UWORLD_S1`) · `22` MedPark 120 HY (`MEDPARK_FREE_120_S1`)

Step 2 main banks: `5` Amboss · `6` CMS · `7` Mehlman · `8` NBME · `9` UWorld

Question banks: UWorld Step 1 = `19` (3654 questions) · Self Assessments `20`–`22` (160 each, block) · NBME `3`–`18`

## 2. Bank workspace (`/qbank/:bankId`)

Implemented in `src/pages/qbank/QbankWorkspace.tsx`; renders a dark sidebar + topbar and an `<Outlet />` for three nested routes:

- `/qbank/:bankId` → **Welcome** (`WelcomePage.tsx`)
- `/qbank/:bankId/create-test` → **Create Test** (`CreateTestPage.tsx`)
- `/qbank/:bankId/previous-tests` → **Previous Tests** (`PreviousTestsPage.tsx`)

**Bank resolution:** the `:bankId` is a *question bank* id, so the workspace resolves it with `getQuestionBanks(step)` (not `getMainBanks`) and shares `{ bank, step }` as `WorkspaceContext` through `useOutletContext()`. Getting this wrong was a real bug, fixed in commit `6ed68e6`.

## 3. Welcome / performance (`WelcomePage.tsx`)

- Score and usage donut charts
- Score, change, usage and test-count tiles
- Percentile bell curve
- Data from `getQbankStatistics(qBankCode, step)`

### Locked results (HTTP 423)

Block-style banks with no completed attempts return **HTTP 423**. Instead of an error state, the page renders a friendly panel explaining that results are locked (the block must be completed) with a call-to-action into Create Test — commit `f9274cf`.

## 4. Previous Tests (`PreviousTestsPage.tsx`)

Table of past tests from `getPreviousTests(step, qBankId)`: name, type (tutor/timed), mode, question count, score/percentage, creation date, and a link that opens `/test/:testId`.

## 5. Test runner (`TestPage.tsx`) — placeholder

Currently a card that fetches `GET /tests/:id`, shows status and question count behind the heartbeat loader, and links back to the dashboard. The runner itself (question view, answering, timer, submit, results, explanations) is the next major piece of work — see [ROADMAP.md](ROADMAP.md) and the endpoint list in [API_REFERENCE.md](API_REFERENCE.md).