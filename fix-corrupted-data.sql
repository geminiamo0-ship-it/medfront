-- Fix corrupted test data
-- Run this in your PostgreSQL database

-- 1. Fix corrupted answeredQuestions count (the 111111111111111111 issue)
UPDATE tests
SET "answeredQuestions" = (
  SELECT COUNT(*)
  FROM question_submissions
  WHERE question_submissions."testId" = tests.id
)
WHERE "answeredQuestions" > "totalQuestions" * 10 -- Clearly corrupted if answered > 10x total
   OR "answeredQuestions" < 0;

-- 2. Fix corrupted correctAnswers count (negative values)
UPDATE tests
SET "correctAnswers" = (
  SELECT COUNT(*)
  FROM question_submissions
  WHERE question_submissions."testId" = tests.id
    AND question_submissions."isCorrect" = true
)
WHERE "correctAnswers" < 0
   OR "correctAnswers" > "answeredQuestions";

-- 3. Recalculate percentage scores
UPDATE tests
SET "percentageScore" = 
  CASE 
    WHEN "answeredQuestions" > 0 
    THEN ROUND(("correctAnswers"::decimal / "answeredQuestions"::decimal) * 100, 2)
    ELSE 0
  END
WHERE status = 'completed';

-- 4. Fix corrupted timeSpentSeconds in question_submissions (the 5315794736894737 issue)
UPDATE question_submissions
SET "timeSpentSeconds" = 60 -- Default to 60 seconds for corrupted values
WHERE "timeSpentSeconds" IS NULL
   OR "timeSpentSeconds" < 0
   OR "timeSpentSeconds" > 3600; -- More than 1 hour is unreasonable

-- 5. Fix corrupted timeSpentSeconds in tests table
UPDATE tests
SET "timeSpentSeconds" = (
  SELECT COALESCE(SUM("timeSpentSeconds"), 0)
  FROM question_submissions
  WHERE question_submissions."testId" = tests.id
)
WHERE "timeSpentSeconds" IS NULL
   OR "timeSpentSeconds" < 0
   OR "timeSpentSeconds" > 86400; -- More than 24 hours is unreasonable

-- 6. Verify the fixes
SELECT 
  id,
  title,
  "totalQuestions",
  "answeredQuestions",
  "correctAnswers",
  "percentageScore",
  "timeSpentSeconds",
  status
FROM tests
WHERE "userId" = 182 -- Replace with your user ID
ORDER BY "createdAt" DESC;

-- 7. Check question submissions
SELECT 
  id,
  "testId",
  "questionId",
  "isCorrect",
  "timeSpentSeconds",
  "answerChanges"
FROM question_submissions
WHERE "userId" = 182 -- Replace with your user ID
ORDER BY "submittedAt" DESC
LIMIT 20;
