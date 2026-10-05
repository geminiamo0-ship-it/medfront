const EASY_THRESHOLD = 75;
const MEDIUM_THRESHOLD = 40;
const EASY = 'easy';
const MEDIUM = 'medium';
const HARD = 'hard';

export type DerivedQuestionDifficulty = typeof EASY | typeof MEDIUM | typeof HARD;

export const resolveDifficultyFromCorrectOptionRate = (
  uworldChosenBy: number | null | undefined,
): DerivedQuestionDifficulty => {
  const normalized = Number(uworldChosenBy);
  if (!Number.isFinite(normalized)) {
    return MEDIUM;
  }

  if (normalized >= EASY_THRESHOLD) {
    return EASY;
  }

  if (normalized >= MEDIUM_THRESHOLD) {
    return MEDIUM;
  }

  return HARD;
};

// ─────────────────────────────────────────────────────────────────────────
// NOTE — 5-tier Create-Test difficulty (very_hard/hard/medium/easy/very_easy)
// is NOT computed here. It lives in the STORED questions.difficulty column,
// backfilled and trigger-maintained in the database; the bucket thresholds'
// single source of truth is recompute_question_difficulty() in migration
// 1803000000014-AddQuestionDifficultyColumn. The 3-tier resolver above
// remains only for the legacy analytics/performance surfaces.
// ─────────────────────────────────────────────────────────────────────────
