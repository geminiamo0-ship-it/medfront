export const authUserCacheKey = (userId: number) => `auth:user:${userId}`;

export const userSettingsCacheKey = (userId: number) => `user_settings:${userId}`;

export const staticQuestionContentCacheKey = (questionId: number) =>
  `static_questions:${questionId}:content`;

export const questionAnswerCacheKey = (questionId: number) =>
  `question_keys:${questionId}:answer`;

// ─── Fix #3: Static taxonomy ────────────────────────────────────────────────
// Tables that effectively never change at runtime — they're seeded/imported.
// Long TTL (24h) + admin-write invalidation.
export const taxonomyTopicsCacheKey = () => `taxonomy:topics:active`;
export const taxonomySystemsCacheKey = () => `taxonomy:systems:active`;
export const taxonomyQuestionBanksCacheKey = (step?: number, mainBankId?: number) =>
  `taxonomy:banks:step:${step ?? 'all'}:mainBank:${mainBankId ?? 'all'}`;
export const taxonomyLabValuesCacheKey = () => `taxonomy:lab_values:grouped`;

// ─── Fix #4: Per-bank static totals ─────────────────────────────────────────
// Total active-question count per bank, scoped by step/mainBankId.
// Shared across all users; per-user progress (used/omitted) stays uncached.
export const bankTotalsCacheKey = (step?: number, mainBankId?: number) =>
  `bank:totals:step:${step ?? 'all'}:mainBank:${mainBankId ?? 'all'}`;

// ─── Fix #5: Question explanations ──────────────────────────────────────────
// Explanation HTML + correct-option metadata. Static unless admin edits.
export const questionExplanationCacheKey = (questionId: number) =>
  `question:explanation:${questionId}`;

// ─── Fix #2: app_settings ───────────────────────────────────────────────────
// Entire app_settings table cached as one object keyed by setting key.
export const appSettingsAllCacheKey = () => `app_settings:all`;

// ─── Fix #1 (audit follow-up): filter-counts epoch ──────────────────────────
// Per-user counter that's spliced into every filter-counts cache key. Bumping
// the epoch orphans every cached (step, filter) variant for that user in a
// single Redis write — no need to enumerate which filter hashes were used.
// Stored separately with a long TTL so it survives normal cache eviction.
export const userCountsEpochCacheKey = (userId: number) =>
  `user_performance:${userId}:counts_epoch`;

export const userFilterCountsCacheKey = (
  userId: number,
  epoch: string,
  step: number,
  filterHash: string,
  hasActiveSubscription: boolean,
) =>
  // `sub` segment splits cached counts by subscription state. When a user's
  // subscription expires mid-window, their next read hits `:sub:0:…` (a fresh
  // miss) instead of returning counts that include premium banks they no
  // longer have access to. The cost is at most a 2× key cardinality.
  `user_performance:${userId}:question_counts:v${epoch}:sub:${hasActiveSubscription ? 1 : 0}:step:${step}:filters:${filterHash}`;

// ─── Difficulty distribution per bank ───────────────────────────────────────
// Count of questions per 5-tier difficulty (stored questions.difficulty),
// scoped by step + bank set. Pure content metadata — changes only on bank
// imports and admin option edits, so it's shared across ALL users and cached
// long. A global epoch is spliced into the key: bumping it on admin writes
// orphans every cached (step, banks) variant in one write; imports run
// offline and are covered by the TTL.
export const difficultyCountsEpochCacheKey = () => `difficulty_counts:epoch`;
export const difficultyCountsCacheKey = (
  epoch: string,
  step: number,
  bankIdsKey: string,
) => `difficulty_counts:v${epoch}:step:${step}:banks:${bankIdsKey}`;

// ─── TTL constants (in milliseconds) ────────────────────────────────────────
export const TAXONOMY_TTL_MS = 24 * 60 * 60 * 1000;       // 24h
export const BANK_TOTALS_TTL_MS = 60 * 60 * 1000;          // 1h
export const QUESTION_EXPLANATION_TTL_MS = 4 * 60 * 60 * 1000; // 4h
export const APP_SETTINGS_TTL_MS = 12 * 60 * 60 * 1000;    // 12h
export const FILTER_COUNTS_TTL_MS = 60 * 1000;             // 60s
export const USER_COUNTS_EPOCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
export const DIFFICULTY_COUNTS_TTL_MS = 24 * 60 * 60 * 1000;     // 24h
export const DIFFICULTY_COUNTS_EPOCH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
