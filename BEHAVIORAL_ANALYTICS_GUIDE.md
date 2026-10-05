# 🧠 Behavioral Analytics & Contest Flow

## Overview
This document explains how MedPark tracks and analyzes student behavior to provide deep insights into their exam-taking patterns, confidence levels, and areas for improvement.

---

## 📊 Behavioral Tracking System

### **Three-Layer Tracking Architecture**

```
Layer 1: QuestionInteraction (Micro-level)
    ↓ Every click, hover, selection
Layer 2: QuestionSubmission (Macro-level)
    ↓ Aggregated behavior + final answer
Layer 3: Analytics Dashboard
    ↓ Insights, patterns, recommendations
```

---

## 🔍 Layer 1: QuestionInteraction Entity

### **What We Track**
Every single interaction with a question:

```typescript
{
  actionType: 'select',
  selectedOptionId: 'option-b-id',
  timeFromStartMs: 15000, // 15 seconds after viewing
  metadata: {
    previousOptionId: null, // First selection
    scrollPosition: 250,
    deviceType: 'desktop'
  }
}
```

### **Example: Student Behavior Sequence**

**Scenario:** Student answering a Pediatrics question

```
Time 0s:    ACTION: view (question loaded)
Time 12s:   ACTION: hover (option B)
Time 18s:   ACTION: select (option B) ← First choice
Time 45s:   ACTION: deselect (option B)
Time 47s:   ACTION: select (option C) ← Changed mind
Time 89s:   ACTION: deselect (option C)
Time 92s:   ACTION: select (option D) ← Changed again
Time 105s:  ACTION: flag (marked for review)
Time 180s:  ACTION: select (option B) ← Back to first choice
Time 185s:  ACTION: submit (option B) ← Final answer
```

**Analysis:**
- **Answer Changes:** 3 (B → C → D → B)
- **Answer Sequence:** ['B', 'C', 'D', 'B']
- **Time to First Answer:** 18 seconds
- **Total Time:** 185 seconds
- **Behavior Flags:**
  - `multipleChanges: true` (3 changes)
  - `hesitant: true` (long deliberation)
  - `markedForReview: true`

---

## 📈 Layer 2: QuestionSubmission Entity

### **Aggregated Behavioral Metrics**

```typescript
{
  questionId: "q-12345",
  selectedOptionId: "option-b-id",
  isCorrect: true,
  timeSpentSeconds: 185,
  
  // BEHAVIORAL ANALYTICS
  answerChanges: 3,
  answerSequence: ['B', 'C', 'D', 'B'],
  timeToFirstAnswer: 18,
  timeInReview: 60,
  wasGuessed: false,
  
  behaviorFlags: {
    quickAnswer: false,
    slowAnswer: true, // > 3 minutes
    multipleChanges: true,
    lastMinuteChange: false,
    hesitant: true
  },
  
  // COMPUTED
  confidenceScore: 55, // Low due to multiple changes
  performanceCategory: 'moderate' // Correct but hesitant
}
```

### **Confidence Score Algorithm**

```typescript
Base Score: 100

Deductions:
- Answer Changes: -15 per change
- Guessed (< 10s): -30
- Multiple Changes (3+): -20
- Last Minute Change: -10
- Slow Answer (> 5min): -10

Example:
100 - (3 × 15) - 20 - 10 = 25 (Low Confidence)
```

### **Performance Categories**

| Category | Criteria |
|----------|----------|
| **Strong** | Correct + 0 changes + < 2 minutes |
| **Moderate** | Correct + ≤ 1 change |
| **Weak** | Correct but multiple changes OR incorrect |
| **Guessed** | Answered in < 10 seconds |

---

## 🏆 Contest Flow - Complete Journey

### **Phase 1: Registration**

```
User Action → System Response

1. Browse Contests
   ↓
2. Click "Register"
   ↓
3. System Checks:
   - Is registration open?
   - Spots available?
   - User has required subscription?
   ↓
4. Create ContestParticipant
   status: REGISTERED
   registeredAt: timestamp
   ↓
5. Send Confirmation Email
```

**Database State:**
```typescript
{
  contestId: "contest-123",
  userId: "user-456",
  status: "registered",
  registeredAt: "2026-01-28T10:00:00Z"
}
```

---

### **Phase 2: Pre-Contest (Waiting Room)**

```
Contest Start Time Approaches
   ↓
T-15 minutes: Email reminder
   ↓
T-5 minutes: Push notification
   ↓
T-0: Contest starts
   ↓
Status: REGISTERED → READY
```

**User sees:**
- Countdown timer
- Contest rules
- "Start Contest" button (enabled at start time)

---

### **Phase 3: Active Contest**

#### **3.1: Contest Initialization**

```
User clicks "Start Contest"
   ↓
System Actions:
1. Update participant status: READY → IN_PROGRESS
2. Record startedAt timestamp
3. Load contest questions
4. Start timer (durationMinutes)
5. Create session ID
```

**Database Update:**
```typescript
{
  status: "in_progress",
  startedAt: "2026-01-28T14:00:00Z",
  lastActivityAt: "2026-01-28T14:00:00Z"
}
```

#### **3.2: Question Answering Loop**

For each question:

```
1. Question Displayed
   ↓ QuestionInteraction: type='view'
   
2. User Reads Question
   ↓ Track scroll, time
   
3. User Selects Option B
   ↓ QuestionInteraction: type='select', optionId='B'
   
4. User Changes to Option C
   ↓ QuestionInteraction: type='deselect', optionId='B'
   ↓ QuestionInteraction: type='select', optionId='C'
   
5. User Changes to Option D
   ↓ QuestionInteraction: type='deselect', optionId='C'
   ↓ QuestionInteraction: type='select', optionId='D'
   
6. User Submits
   ↓ QuestionInteraction: type='submit', optionId='D'
   ↓ Create ContestSubmission
   ↓ Update ContestParticipant stats
```

**ContestSubmission Created:**
```typescript
{
  participantId: "participant-789",
  questionId: "q-12345",
  questionNumber: 5,
  selectedOptionId: "option-d-id",
  isCorrect: false,
  pointsAwarded: 0,
  timeSpentSeconds: 142,
  answerChanges: 2,
  answerSequence: ['B', 'C', 'D'],
  submittedAt: "2026-01-28T14:02:22Z"
}
```

**ContestParticipant Updated:**
```typescript
{
  totalScore: 45, // Previous questions
  correctAnswers: 4,
  wrongAnswers: 1, // This question
  totalAnswerChanges: 8, // Cumulative
  lastActivityAt: "2026-01-28T14:02:22Z"
}
```

#### **3.3: Real-Time Monitoring**

```
Every 30 seconds:
- Update lastActivityAt
- Check if time expired
- Detect idle users (no activity > 5 min)
```

---

### **Phase 4: Contest Completion**

#### **4.1: Normal Completion**

```
User answers last question
   ↓
System Actions:
1. Update status: IN_PROGRESS → COMPLETED
2. Record completedAt timestamp
3. Calculate final score
4. Calculate accuracy percentage
5. Aggregate behavioral metrics
6. Determine rank (after all finish)
```

**Final ContestParticipant State:**
```typescript
{
  status: "completed",
  completedAt: "2026-01-28T14:45:30Z",
  totalScore: 87,
  correctAnswers: 18,
  wrongAnswers: 2,
  unansweredQuestions: 0,
  timeSpentSeconds: 2730, // 45.5 minutes
  accuracyPercentage: 90.00,
  totalAnswerChanges: 12,
  averageTimePerQuestion: 136.5,
  
  behaviorSummary: {
    rushingPattern: false,
    hesitationPattern: true,
    strongStart: true,
    strongFinish: false,
    consistentPace: true
  }
}
```

#### **4.2: Time Expired**

```
Contest duration reached
   ↓
System Actions:
1. Auto-submit current question
2. Mark unanswered questions
3. Update status: IN_PROGRESS → TIMED_OUT
4. Calculate score with penalties
```

---

### **Phase 5: Post-Contest Analytics**

#### **5.1: Leaderboard Calculation**

```sql
-- Ranking Algorithm
SELECT 
  participant_id,
  total_score,
  time_spent_seconds,
  RANK() OVER (
    ORDER BY 
      total_score DESC,
      time_spent_seconds ASC -- Tiebreaker: faster wins
  ) as rank
FROM contest_participants
WHERE contest_id = 'contest-123'
  AND status IN ('completed', 'timed_out')
```

#### **5.2: Behavioral Analysis Report**

**Generated for each participant:**

```typescript
{
  overallPerformance: {
    rank: 15,
    percentile: 85, // Top 15%
    score: 87,
    accuracy: 90%
  },
  
  behavioralInsights: {
    answerChangingPattern: "moderate", // 12 changes / 20 questions
    confidenceLevel: "medium",
    timeManagement: "good",
    
    strengths: [
      "Strong start (95% accuracy in first 10 questions)",
      "Consistent pacing throughout contest",
      "Good time management (finished with 5 min remaining)"
    ],
    
    weaknesses: [
      "Performance declined in final 5 questions",
      "High answer-changing rate in Cardiology questions",
      "Hesitant on medium-difficulty questions"
    ],
    
    recommendations: [
      "Review Cardiology concepts - you changed answers 4 times",
      "Trust your first instinct more - 60% of your changes were wrong",
      "Practice time pressure - you slowed down significantly in second half"
    ]
  },
  
  subjectBreakdown: {
    "Pediatrics": { attempted: 5, correct: 5, accuracy: 100% },
    "Cardiology": { attempted: 4, correct: 2, accuracy: 50% },
    "Neurology": { attempted: 6, correct: 6, accuracy: 100% },
    // ...
  },
  
  comparisonToAverage: {
    yourScore: 87,
    averageScore: 72,
    yourTime: 2730,
    averageTime: 2850,
    yourChanges: 12,
    averageChanges: 8
  }
}
```

---

## 🎯 Analytics Use Cases

### **1. Student Dashboard**

**"Your Exam Behavior"**
```
📊 Answer Changing Pattern
You changed your answer 3+ times on 15% of questions.
When you changed from your first choice, you were:
- Correct → Wrong: 60% of the time ❌
- Wrong → Correct: 40% of the time ✓

💡 Recommendation: Trust your first instinct more!
```

**"Time Management"**
```
⏱️ Average Time Per Question: 2m 18s
- Easy questions: 1m 12s ✓ (Good)
- Medium questions: 2m 45s ⚠️ (Slightly slow)
- Hard questions: 3m 30s ❌ (Too slow)

💡 Recommendation: Practice medium questions under time pressure
```

### **2. Performance Trends**

```typescript
{
  last10Tests: [
    { date: "2026-01-20", answerChanges: 15, accuracy: 75% },
    { date: "2026-01-22", answerChanges: 12, accuracy: 78% },
    { date: "2026-01-25", answerChanges: 8, accuracy: 82% },
    { date: "2026-01-28", answerChanges: 5, accuracy: 88% }
  ],
  
  trend: "improving", // Fewer changes, higher accuracy
  insight: "Your confidence is increasing! Keep it up! 🎉"
}
```

### **3. Weak Area Detection**

```typescript
{
  subjectsNeedingWork: [
    {
      subject: "Cardiology",
      avgChanges: 3.2, // vs 1.5 overall
      accuracy: 65%, // vs 85% overall
      insight: "You're hesitant on Cardiology - review core concepts"
    }
  ]
}
```

---

## 🔐 Privacy & Data Usage

### **What We Track**
✅ Answer selections and changes
✅ Time spent per question
✅ Navigation patterns
✅ Performance metrics

### **What We DON'T Track**
❌ Keystrokes or typing
❌ Screen recording
❌ Eye tracking
❌ Personal browsing outside app

### **Data Retention**
- Raw interactions: 90 days
- Aggregated analytics: Permanent
- Personal identifiers: Anonymized after 1 year

---

## 🚀 Implementation Priority

### **Phase 1 (Current)** ✅
- QuestionInteraction entity
- QuestionSubmission with behavioral fields
- Basic analytics

### **Phase 2 (Next)**
- Contest entities
- Real-time tracking
- Leaderboard system

### **Phase 3 (Future)**
- ML-based insights
- Predictive performance
- Personalized study plans

---

## 📊 Sample Analytics Queries

### **Find students who change answers frequently**
```sql
SELECT user_id, AVG(answer_changes) as avg_changes
FROM question_submissions
GROUP BY user_id
HAVING AVG(answer_changes) > 2
ORDER BY avg_changes DESC;
```

### **Identify "guessers"**
```sql
SELECT user_id, COUNT(*) as guessed_count
FROM question_submissions
WHERE was_guessed = true
GROUP BY user_id
HAVING COUNT(*) > 10;
```

### **Performance by time of day**
```sql
SELECT 
  EXTRACT(HOUR FROM submitted_at) as hour,
  AVG(CASE WHEN is_correct THEN 100 ELSE 0 END) as accuracy
FROM question_submissions
WHERE user_id = 'user-123'
GROUP BY hour
ORDER BY hour;
```

---

This comprehensive tracking system allows MedPark to provide **unprecedented insights** into student exam behavior, helping them identify patterns, build confidence, and improve performance! 🎓✨
