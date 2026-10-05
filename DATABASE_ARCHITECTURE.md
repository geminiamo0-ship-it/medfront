# 🏗️ MedPark Database Architecture

## Overview
This document outlines the complete entity design for MedPark - a comprehensive USMLE preparation platform.

---

## 📊 Core Entity Groups

### 1. **Content Management** (Questions, Library, Resources)
### 2. **User Progress & Performance** (Tests, Submissions, Analytics)
### 3. **Competition System** (Contests, Leaderboards)
### 4. **User Management** (Users, Subscriptions, Preferences)
### 5. **Study Tools** (Notes, Flashcards, Bookmarks)

---

## 🎯 Detailed Entity Design

### **GROUP 1: Content Management**

#### **Subject**
- `id` (UUID, PK)
- `name` (VARCHAR) - e.g., "Pediatrics", "Internal Medicine"
- `code` (VARCHAR, UNIQUE) - e.g., "PED", "IM"
- `description` (TEXT)
- `icon` (VARCHAR) - Icon identifier
- `displayOrder` (INT)
- `isActive` (BOOLEAN)
- `createdAt`, `updatedAt`

#### **System** (Organ Systems)
- `id` (UUID, PK)
- `name` (VARCHAR) - e.g., "Cardiovascular", "Respiratory"
- `code` (VARCHAR, UNIQUE) - e.g., "CARDIO", "RESP"
- `description` (TEXT)
- `icon` (VARCHAR)
- `displayOrder` (INT)
- `isActive` (BOOLEAN)
- `createdAt`, `updatedAt`

#### **Topic**
- `id` (UUID, PK)
- `subjectId` (UUID, FK → Subject)
- `systemId` (UUID, FK → System, NULLABLE)
- `name` (VARCHAR) - e.g., "Immune deficiencies"
- `description` (TEXT)
- `displayOrder` (INT)
- `isActive` (BOOLEAN)
- `createdAt`, `updatedAt`

#### **QuestionBank**
- `id` (UUID, PK)
- `name` (VARCHAR) - e.g., "UWorld", "NBME"
- `code` (VARCHAR, UNIQUE) - e.g., "UWORLD", "NBME"
- `description` (TEXT)
- `step` (ENUM: 1, 2, 3) - USMLE Step
- `totalQuestions` (INT)
- `isPremium` (BOOLEAN) - Requires subscription
- `icon` (VARCHAR)
- `gradient` (VARCHAR) - CSS gradient for UI
- `isActive` (BOOLEAN)
- `createdAt`, `updatedAt`

#### **Question** ⭐ CORE ENTITY
- `id` (UUID, PK)
- `questionBankId` (UUID, FK → QuestionBank)
- `externalId` (VARCHAR, NULLABLE) - e.g., uworld_id
- `textHtml` (TEXT) - Question stem (rich HTML)
- `explanationHtml` (TEXT) - Detailed explanation (rich HTML)
- `subjectId` (UUID, FK → Subject)
- `systemId` (UUID, FK → System, NULLABLE)
- `topicId` (UUID, FK → Topic, NULLABLE)
- `difficulty` (ENUM: 'easy', 'medium', 'hard')
- `step` (ENUM: 1, 2, 3)
- `source` (VARCHAR) - e.g., "uworld", "nbme"
- `imageUrls` (JSON) - Array of image URLs
- `videoUrl` (VARCHAR, NULLABLE)
- `estimatedTimeSeconds` (INT) - Average time to answer
- `timesAnswered` (INT, DEFAULT 0)
- `timesCorrect` (INT, DEFAULT 0)
- `isActive` (BOOLEAN)
- `createdAt`, `updatedAt`

**Indexes:**
- `idx_question_bank` (questionBankId)
- `idx_subject_system` (subjectId, systemId)
- `idx_difficulty_step` (difficulty, step)

#### **QuestionOption**
- `id` (UUID, PK)
- `questionId` (UUID, FK → Question)
- `textHtml` (TEXT) - Option text (rich HTML)
- `isCorrect` (BOOLEAN)
- `displayOrder` (CHAR) - 'A', 'B', 'C', 'D', 'E'
- `explanationHtml` (TEXT, NULLABLE) - Why this option is right/wrong
- `createdAt`, `updatedAt`

**Indexes:**
- `idx_question_options` (questionId)

#### **LibraryResource** (Study Materials)
- `id` (UUID, PK)
- `title` (VARCHAR)
- `contentHtml` (TEXT) - Rich HTML content
- `type` (ENUM: 'article', 'video', 'pdf', 'interactive')
- `subjectId` (UUID, FK → Subject, NULLABLE)
- `systemId` (UUID, FK → System, NULLABLE)
- `topicId` (UUID, FK → Topic, NULLABLE)
- `step` (ENUM: 1, 2, 3, NULLABLE)
- `thumbnailUrl` (VARCHAR, NULLABLE)
- `resourceUrl` (VARCHAR, NULLABLE) - For PDFs, videos
- `estimatedReadTimeMinutes` (INT)
- `isPremium` (BOOLEAN)
- `viewCount` (INT, DEFAULT 0)
- `isActive` (BOOLEAN)
- `createdAt`, `updatedAt`

---

### **GROUP 2: User Progress & Performance**

#### **Test**
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `title` (VARCHAR)
- `type` (ENUM: 'tutor', 'timed', 'custom')
- `mode` (ENUM: 'unused', 'incorrect', 'marked', 'all')
- `step` (ENUM: 1, 2, 3)
- `status` (ENUM: 'in_progress', 'completed', 'abandoned')
- `totalQuestions` (INT)
- `answeredQuestions` (INT, DEFAULT 0)
- `correctAnswers` (INT, DEFAULT 0)
- `percentageScore` (DECIMAL, NULLABLE)
- `timeSpentSeconds` (INT, DEFAULT 0)
- `startedAt` (TIMESTAMP)
- `completedAt` (TIMESTAMP, NULLABLE)
- `createdAt`, `updatedAt`

**Indexes:**
- `idx_user_tests` (userId, status)
- `idx_test_completion` (completedAt)

#### **TestQuestion** (Junction Table)
- `id` (UUID, PK)
- `testId` (UUID, FK → Test)
- `questionId` (UUID, FK → Question)
- `displayOrder` (INT)
- `createdAt`

**Indexes:**
- `idx_test_questions` (testId)

#### **QuestionSubmission**
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `questionId` (UUID, FK → Question)
- `testId` (UUID, FK → Test, NULLABLE)
- `selectedOptionId` (UUID, FK → QuestionOption, NULLABLE)
- `isCorrect` (BOOLEAN)
- `isMarked` (BOOLEAN, DEFAULT false)
- `timeSpentSeconds` (INT)
- `submittedAt` (TIMESTAMP)
- `createdAt`

**Indexes:**
- `idx_user_submissions` (userId, questionId)
- `idx_test_submissions` (testId)
- `idx_marked_questions` (userId, isMarked)

#### **UserPerformance** (Aggregated Stats)
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `subjectId` (UUID, FK → Subject, NULLABLE)
- `systemId` (UUID, FK → System, NULLABLE)
- `step` (ENUM: 1, 2, 3)
- `totalAttempted` (INT, DEFAULT 0)
- `totalCorrect` (INT, DEFAULT 0)
- `percentageCorrect` (DECIMAL)
- `averageTimeSeconds` (INT)
- `lastUpdated` (TIMESTAMP)
- `createdAt`, `updatedAt`

**Unique Constraint:** (userId, subjectId, systemId, step)

---

### **GROUP 3: Competition System**

#### **Contest**
- `id` (UUID, PK)
- `title` (VARCHAR)
- `description` (TEXT)
- `step` (ENUM: 1, 2, 3)
- `totalQuestions` (INT)
- `durationMinutes` (INT)
- `startTime` (TIMESTAMP)
- `endTime` (TIMESTAMP)
- `registrationDeadline` (TIMESTAMP)
- `status` (ENUM: 'upcoming', 'registration_open', 'in_progress', 'completed', 'cancelled')
- `maxParticipants` (INT, NULLABLE)
- `currentParticipants` (INT, DEFAULT 0)
- `isPremium` (BOOLEAN) - Premium users only
- `prizeDescription` (TEXT, NULLABLE)
- `bannerUrl` (VARCHAR, NULLABLE)
- `createdAt`, `updatedAt`

**Indexes:**
- `idx_contest_status_time` (status, startTime)

#### **ContestQuestion** (Junction)
- `id` (UUID, PK)
- `contestId` (UUID, FK → Contest)
- `questionId` (UUID, FK → Question)
- `displayOrder` (INT)
- `points` (INT, DEFAULT 1) - For weighted scoring
- `createdAt`

#### **ContestParticipant**
- `id` (UUID, PK)
- `contestId` (UUID, FK → Contest)
- `userId` (UUID, FK → User)
- `registeredAt` (TIMESTAMP)
- `startedAt` (TIMESTAMP, NULLABLE)
- `completedAt` (TIMESTAMP, NULLABLE)
- `totalScore` (INT, DEFAULT 0)
- `correctAnswers` (INT, DEFAULT 0)
- `timeSpentSeconds` (INT, DEFAULT 0)
- `rank` (INT, NULLABLE)
- `status` (ENUM: 'registered', 'in_progress', 'completed', 'disqualified')
- `createdAt`, `updatedAt`

**Unique Constraint:** (contestId, userId)
**Indexes:**
- `idx_contest_leaderboard` (contestId, totalScore DESC, timeSpentSeconds ASC)

#### **ContestSubmission**
- `id` (UUID, PK)
- `participantId` (UUID, FK → ContestParticipant)
- `questionId` (UUID, FK → Question)
- `selectedOptionId` (UUID, FK → QuestionOption, NULLABLE)
- `isCorrect` (BOOLEAN)
- `points` (INT)
- `timeSpentSeconds` (INT)
- `submittedAt` (TIMESTAMP)
- `createdAt`

---

### **GROUP 4: User Management** (Already Implemented)

✅ **User** - Already exists
✅ **UserPreferences** - Already exists
✅ **UserRole** - Already implemented

---

### **GROUP 5: Study Tools**

#### **Note**
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `questionId` (UUID, FK → Question, NULLABLE)
- `resourceId` (UUID, FK → LibraryResource, NULLABLE)
- `title` (VARCHAR)
- `contentHtml` (TEXT)
- `tags` (JSON) - Array of tags
- `isPinned` (BOOLEAN, DEFAULT false)
- `createdAt`, `updatedAt`

**Indexes:**
- `idx_user_notes` (userId, isPinned)

#### **Flashcard**
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `questionId` (UUID, FK → Question, NULLABLE)
- `front` (TEXT)
- `back` (TEXT)
- `difficulty` (ENUM: 'easy', 'medium', 'hard')
- `nextReviewDate` (DATE) - Spaced repetition
- `reviewCount` (INT, DEFAULT 0)
- `createdAt`, `updatedAt`

**Indexes:**
- `idx_user_flashcards_review` (userId, nextReviewDate)

#### **Bookmark**
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `questionId` (UUID, FK → Question, NULLABLE)
- `resourceId` (UUID, FK → LibraryResource, NULLABLE)
- `folderId` (UUID, FK → BookmarkFolder, NULLABLE)
- `note` (TEXT, NULLABLE)
- `createdAt`

**Unique Constraint:** (userId, questionId) OR (userId, resourceId)

#### **BookmarkFolder**
- `id` (UUID, PK)
- `userId` (UUID, FK → User)
- `name` (VARCHAR)
- `description` (TEXT, NULLABLE)
- `color` (VARCHAR) - Hex color
- `displayOrder` (INT)
- `createdAt`, `updatedAt`

---

## 🔗 Key Relationships

```
User (1) ─── (N) Test
User (1) ─── (N) QuestionSubmission
User (1) ─── (N) ContestParticipant
User (1) ─── (N) Note
User (1) ─── (N) Flashcard
User (1) ─── (N) Bookmark

QuestionBank (1) ─── (N) Question
Question (1) ─── (N) QuestionOption
Question (1) ─── (N) QuestionSubmission
Question (N) ─── (N) Test (via TestQuestion)
Question (N) ─── (N) Contest (via ContestQuestion)

Subject (1) ─── (N) Question
System (1) ─── (N) Question
Topic (1) ─── (N) Question

Contest (1) ─── (N) ContestParticipant
ContestParticipant (1) ─── (N) ContestSubmission
```

---

## 📈 Scalability Considerations

### **Performance Optimizations**
1. **Partitioning**: Partition `QuestionSubmission` by `submittedAt` (monthly)
2. **Caching**: Redis cache for:
   - Question content (rarely changes)
   - Leaderboards (computed periodically)
   - User statistics (updated async)
3. **Read Replicas**: For analytics and reporting queries
4. **Indexes**: Strategic indexes on foreign keys and query patterns

### **Data Volume Estimates** (5 years)
- Questions: ~50,000
- Users: ~100,000
- Submissions: ~50M (500 submissions/user avg)
- Tests: ~500,000
- Contests: ~500

### **Storage Strategy**
- **HTML Content**: Store in database (searchable, fast)
- **Images**: CDN (S3/CloudFront)
- **Videos**: CDN with streaming
- **PDFs**: CDN with signed URLs

---

## 🔄 Migration Strategy

### **Phase 1: Core Content** (Week 1-2)
- Subject, System, Topic
- QuestionBank, Question, QuestionOption

### **Phase 2: User Progress** (Week 3)
- Test, TestQuestion
- QuestionSubmission
- UserPerformance

### **Phase 3: Competition** (Week 4)
- Contest, ContestQuestion
- ContestParticipant, ContestSubmission

### **Phase 4: Study Tools** (Week 5)
- Note, Flashcard
- Bookmark, BookmarkFolder

### **Phase 5: Library** (Week 6)
- LibraryResource

---

## ✅ Next Steps

1. **Review & Approve** this architecture
2. **Create TypeORM Entities** (Phase 1 first)
3. **Generate Migrations**
4. **Seed Sample Data**
5. **Build API Endpoints**
6. **Frontend Integration**
