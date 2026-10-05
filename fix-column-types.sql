-- Fix column types for CockroachDB
-- CockroachDB requires dropping indexes before altering column types

-- STEP 1: Drop indexes that reference the columns we need to alter
-- Find indexes with: SELECT * FROM pg_indexes WHERE tablename IN ('questions', 'question_submissions', 'tests');

-- Drop indexes on questions table
DROP INDEX IF EXISTS questions_difficulty_step_idx;
DROP INDEX IF EXISTS idx_questions_difficulty_step;

-- Drop indexes on question_submissions table  
DROP INDEX IF EXISTS question_submissions_submitted_at_idx;
DROP INDEX IF EXISTS idx_question_submissions_submitted_at;

-- Drop indexes on tests table
DROP INDEX IF EXISTS tests_user_id_status_idx;
DROP INDEX IF EXISTS tests_completed_at_idx;
DROP INDEX IF EXISTS idx_tests_user_id_status;
DROP INDEX IF EXISTS idx_tests_completed_at;

-- STEP 2: Alter column types
-- Questions table
ALTER TABLE questions 
ALTER COLUMN step TYPE integer USING step::integer;

-- Question submissions table
ALTER TABLE question_submissions 
ALTER COLUMN "timeSpentSeconds" TYPE integer USING "timeSpentSeconds"::integer;

ALTER TABLE question_submissions 
ALTER COLUMN "answerChanges" TYPE integer USING "answerChanges"::integer;

ALTER TABLE question_submissions 
ALTER COLUMN "timeToFirstAnswer" TYPE integer USING "timeToFirstAnswer"::integer;

ALTER TABLE question_submissions 
ALTER COLUMN "timeInReview" TYPE integer USING "timeInReview"::integer;

-- Tests table
ALTER TABLE tests 
ALTER COLUMN "answeredQuestions" TYPE integer USING "answeredQuestions"::integer;

ALTER TABLE tests 
ALTER COLUMN "correctAnswers" TYPE integer USING "correctAnswers"::integer;

ALTER TABLE tests 
ALTER COLUMN "totalQuestions" TYPE integer USING "totalQuestions"::integer;

ALTER TABLE tests 
ALTER COLUMN "timeSpentSeconds" TYPE integer USING "timeSpentSeconds"::integer;

ALTER TABLE tests 
ALTER COLUMN "timeLimitSeconds" TYPE integer USING "timeLimitSeconds"::integer;

-- STEP 3: Recreate indexes
-- Questions table indexes
CREATE INDEX IF NOT EXISTS questions_difficulty_step_idx ON questions (difficulty, step);

-- Question submissions table indexes
CREATE INDEX IF NOT EXISTS question_submissions_submitted_at_idx ON question_submissions ("submittedAt");

-- Tests table indexes
CREATE INDEX IF NOT EXISTS tests_user_id_status_idx ON tests ("userId", status);
CREATE INDEX IF NOT EXISTS tests_completed_at_idx ON tests ("completedAt");

-- STEP 4: Verify the changes
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'questions' AND column_name = 'step';

SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'question_submissions' 
  AND column_name IN ('timeSpentSeconds', 'answerChanges', 'timeToFirstAnswer', 'timeInReview');

SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'tests' 
  AND column_name IN ('answeredQuestions', 'correctAnswers', 'totalQuestions', 'timeSpentSeconds', 'timeLimitSeconds');
