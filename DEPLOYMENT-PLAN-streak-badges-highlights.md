# Deployment Plan — Streak, Badges & Highlights

> Branch: dev → production  
> Prepared: 2026-05-22  
> Covers everything shipped in this release cycle.

---

## 1. What Changed (Summary)

| Area | Change |
|------|--------|
| **Streak / Daily Stats** | `user_daily_stats` backfill + question streak recalculation |
| **Special Badges** | New `special_badge_types` + `user_special_badges` tables, 8 default types seeded |
| **Question Highlights** | New isolated `user_question_highlights` table (decoupled from submissions) |
| **Frontend** | Badge icons, homepage redesign, leaderboard disabled, daily goal history |

---

## 2. Pre-Deployment Checklist

- [ ] Pull latest `dev` branch to production server
- [ ] Verify `.env` is up-to-date (no new required vars in this release)
- [ ] Confirm Redis is running (required for production startup)
- [ ] Take a **database backup** before running any migrations

```bash
# Quick pg_dump backup before anything
pg_dump -U $DB_USERNAME -h $DB_HOST $DB_DATABASE > backup_pre_release_$(date +%Y%m%d).sql
```

---

## 3. Migrations to Run

Three new migrations must run **in order**. They are sequential and safe to run with `migration:run`.

```bash
npm run migration:run
```

### What each migration does

| # | File | Action |
|---|------|--------|
| `1802000000001` | `AddSpecialBadges` | Creates `special_badge_types` + `user_special_badges` tables, seeds 8 default badge types |
| `1802000000002` | `AddHighlightHtmlCache` | Temporarily added HTML cache columns to `question_submissions` (superseded by 003) |
| `1802000000003` | `AddUserQuestionHighlights` | Creates `user_question_highlights` table, drops the temp columns from `question_submissions` |

> **Note:** Migration 002 and 003 are tightly paired. 003 drops what 002 added. Running `migration:run` executes them in order automatically — do not run them individually out of order.

### Verify migrations ran

```bash
npm run migration:show
# All three should show [X] (executed)
```

---

## 4. Post-Migration: Backfill Script

After migrations, run the backfill to populate historical streak data.  
**This is a one-time operation** — safe to re-run (uses `ON CONFLICT DO UPDATE`).

### PowerShell (Windows)
```powershell
$env:TYPEORM_ENTITIES="ts"; npx ts-node -r tsconfig-paths/register src/scripts/backfill-daily-stats.ts
```

### Bash (Linux/Mac/CI)
```bash
TYPEORM_ENTITIES=ts npx ts-node -r tsconfig-paths/register src/scripts/backfill-daily-stats.ts
```

### What it does
1. **Aggregates** all `question_submissions` rows → `user_daily_stats` (per user, per UTC day)
2. **Recalculates** `question_streak`, `longest_question_streak`, `last_question_date` on every user in the `users` table

### Expected output
```
Connected. Starting backfill...
Daily stats aggregated.
...
Done. Processed N users.
```

### ⚠️ What it does NOT backfill
- **Login streak** — tracked live on each login request; no historical login log exists to reconstruct from. Users will see their streak reset to 0 on first login after deploy and rebuild from there.
- **Monthly badges** — calculated on-the-fly from `user_daily_stats` in `users.service.ts`, no extra step needed.
- **Special badge assignments** — admin awards these manually via the dashboard at `/admin/badges`.

---

## 5. Deploy Frontend Build

```bash
cd MedPark-Frontend
npm run build
# Deploy dist/ to your CDN / static host
```

### Key frontend changes in this release
- `BadgeSvgIcon` component — hexagonal badge frames with tier icons
- Homepage redesigned (daily goal history strip, leaderboard removed, colors updated)
- Admin badges page — award-to-user flow with live user search
- Question highlights — cross-device sync via `user_question_highlights` table
- Leaderboard routes now redirect to `/` (disabled until further notice)

---

## 6. Smoke Tests After Deploy

Run through these manually after pushing to production.

### Streaks
- [ ] Log in as a real user → homepage shows correct **Login Streak** count
- [ ] Check **Study Streak** — should reflect actual question-solving history
- [ ] Check **Monthly Badges** grid — Bronze/Silver/Gold/Platinum display correctly for months with activity

### Daily Goal
- [ ] Daily goal ring shows today's progress
- [ ] "This week / This month / All time" goals-reached counts are populated

### Highlights (cross-device)
- [ ] Highlight text on Question A in Browser 1
- [ ] Open same test in Browser 2 (or incognito) → highlight appears
- [ ] Ensure no ghost submissions created for unanswered questions

### Special Badges
- [ ] Go to `/admin/badges` — all 8 default badge types visible
- [ ] Search a user → click a badge → award it → confirm it appears on that user's homepage
- [ ] Confirm badge shows **"Awarded by MedPark"** (not admin name) on user's homepage

### Leaderboard
- [ ] Visit `https://medpark.io/Leaderboard` → should redirect to `/`
- [ ] Homepage no longer shows "Leaderboard Rank" card

---

## 7. Rollback Plan

If anything goes wrong after deploy:

### Revert migrations
```bash
npm run migration:revert   # reverts 003
npm run migration:revert   # reverts 002
npm run migration:revert   # reverts 001
```

> Running revert three times rolls back all three migrations in reverse order.  
> **Warning:** reverting 001 drops `special_badge_types` and `user_special_badges` — any manually awarded badges will be lost.

### Revert backfill
The backfill only writes to `user_daily_stats` and updates streak columns on `users`.  
To undo, restore from the pre-deployment backup:

```bash
psql -U $DB_USERNAME -h $DB_HOST $DB_DATABASE < backup_pre_release_YYYYMMDD.sql
```

---

## 8. Notes for Next Release

- **Login streak backfill** — if needed in future, requires adding a login-event log table first and then writing a separate backfill script.
- **Daily goal sync** — currently stored in `localStorage` only (per browser). If cross-device daily goal sync is needed, add a `daily_goal` column to `user_preferences` and a `PATCH /api/users/preferences` endpoint.
- **Re-enable leaderboard** — uncomment `LeaderboardPage` import in `App.tsx`, restore routes, set `SHOW_LEADERBOARDS = true` in `constants.ts`.
- **Badge thresholds** — editable from `/admin/badges`. Default: Bronze ≤49, Silver ≤149, Gold ≤299, Platinum >299. Changes take effect immediately (no migration needed, stored in `app_settings`).
