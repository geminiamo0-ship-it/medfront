-- Drop all tables to allow fresh migration with integer IDs
DROP TABLE IF EXISTS contest_submissions CASCADE;
DROP TABLE IF EXISTS contest_participants CASCADE;
DROP TABLE IF EXISTS contests CASCADE;
DROP TABLE IF EXISTS question_submissions CASCADE;
DROP TABLE IF EXISTS question_interactions CASCADE;
DROP TABLE IF EXISTS question_options CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS question_banks CASCADE;
DROP TABLE IF EXISTS systems CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop all enums
DROP TYPE IF EXISTS contests_status_enum CASCADE;
DROP TYPE IF EXISTS contests_type_enum CASCADE;
DROP TYPE IF EXISTS contest_participants_status_enum CASCADE;
DROP TYPE IF EXISTS question_interactions_actiontype_enum CASCADE;
DROP TYPE IF EXISTS questions_difficulty_enum CASCADE;
DROP TYPE IF EXISTS user_preferences_theme_enum CASCADE;
DROP TYPE IF EXISTS users_role_enum CASCADE;
DROP TYPE IF EXISTS users_subscriptionplan_enum CASCADE;
DROP TYPE IF EXISTS users_ratingtier_enum CASCADE;
