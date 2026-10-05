/**
 * One-time backfill: aggregate QuestionSubmission rows into user_daily_stats,
 * then recompute question streaks on the users table.
 *
 * Run with:
 *   TYPEORM_ENTITIES=ts npx ts-node -r tsconfig-paths/register src/scripts/backfill-daily-stats.ts
 */

import { config } from 'dotenv';
config();

import dataSource from '../config/typeorm.config';

async function run() {
  await dataSource.initialize();
  console.log('Connected. Starting backfill...');

  // 1. Aggregate submissions → user_daily_stats
  // Note: TypeORM uses camelCase column names in question_submissions ("userId", "submittedAt", "isCorrect", "selectedOptionId")
  await dataSource.query(`
    WITH agg AS (
      SELECT
        "userId"   AS uid,
        DATE("submittedAt" AT TIME ZONE 'UTC') AS day,
        COUNT(*)::int AS qa,
        SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END)::int AS cc
      FROM question_submissions
      WHERE "selectedOptionId" IS NOT NULL
      GROUP BY "userId", DATE("submittedAt" AT TIME ZONE 'UTC')
    )
    INSERT INTO user_daily_stats (user_id, date, questions_attempted, correct_count, created_at, updated_at)
    SELECT uid, day, qa, cc, now(), now()
    FROM agg
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      questions_attempted = EXCLUDED.questions_attempted,
      correct_count       = EXCLUDED.correct_count,
      updated_at          = now()
  `);
  console.log('Daily stats aggregated.');

  // 2. Recompute last_question_date and question_streak for every user
  const users = await dataSource.query(`
    SELECT DISTINCT user_id FROM user_daily_stats ORDER BY user_id
  `);

  let processed = 0;
  for (const { user_id } of users) {
    const rows = await dataSource.query(
      `SELECT date FROM user_daily_stats WHERE user_id = $1 ORDER BY date ASC`,
      [user_id],
    );

    if (!rows.length) continue;

    const dates: string[] = rows.map((r: any) => r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10));
    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    // Check if current streak is still alive (last date is today or yesterday)
    const lastDate = dates[dates.length - 1];
    const todayUTC = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayUTC = yesterday.toISOString().slice(0, 10);
    const isAlive = lastDate === todayUTC || lastDate === yesterdayUTC;

    await dataSource.query(
      `UPDATE users SET
        last_question_date = $1,
        question_streak = $2,
        longest_question_streak = $3
       WHERE "id" = $4`,
      [lastDate, isAlive ? currentStreak : 0, maxStreak, user_id],
    );

    processed++;
    if (processed % 100 === 0) console.log(`Processed ${processed} users...`);
  }

  console.log(`Done. Processed ${processed} users.`);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
