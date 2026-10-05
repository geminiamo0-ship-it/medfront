# 🎯 Test Creation API - Complete Implementation

## ✅ What Was Built

A **complete test creation system** allowing users to create custom practice tests with advanced filtering, behavioral tracking, and detailed analytics.

---

## 📦 New Entities Created

### 1. **Test Entity** (`test.entity.ts`)
- Stores test metadata and progress
- Supports multiple test types (Tutor, Timed, Custom)
- Tracks completion status and scores
- **Fields**: title, type, mode, filters, totalQuestions, answeredQuestions, correctAnswers, percentageScore, timeSpentSeconds

### 2. **TestQuestion Entity** (`test-question.entity.ts`)
- Junction table linking tests to questions
- Maintains question order in tests
- **Fields**: testId, questionId, displayOrder

---

## 🔌 API Endpoints

All endpoints are protected with JWT authentication (`@UseGuards(JwtAuthGuard)`).

### **POST /api/tests**
Create a new test with filters

**Request Body:**
```json
{
  "title": "Pediatrics Practice Test",
  "type": "tutor",
  "mode": "unused",
  "step": 1,
  "totalQuestions": 20,
  "filters": {
    "subjectIds": [1],
    "systemIds": [8],
    "difficulty": ["medium", "hard"],
    "questionBankIds": [1]
  }
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "title": "Pediatrics Practice Test",
  "type": "tutor",
  "mode": "unused",
  "step": 1,
  "status": "in_progress",
  "totalQuestions": 20,
  "answeredQuestions": 0,
  "correctAnswers": 0,
  "startedAt": "2026-01-29T00:00:00.000Z"
}
```

---

### **GET /api/tests**
Get all tests for the logged-in user

**Response:**
```json
[
  {
    "id": 1,
    "title": "Pediatrics Practice Test",
    "type": "tutor",
    "status": "in_progress",
    "totalQuestions": 20,
    "answeredQuestions": 5,
    "correctAnswers": 4,
    "percentageScore": null,
    "createdAt": "2026-01-29T00:00:00.000Z"
  }
]
```

---

### **GET /api/tests/:id**
Get a specific test with all questions

**Response:**
```json
{
  "id": 1,
  "title": "Pediatrics Practice Test",
  "type": "tutor",
  "status": "in_progress",
  "totalQuestions": 20,
  "answeredQuestions": 5,
  "questions": [
    {
      "id": 1,
      "displayOrder": 1,
      "textHtml": "<p>Question text...</p>",
      "explanationHtml": "<p>Explanation...</p>",
      "difficulty": "medium",
      "estimatedTimeSeconds": 120,
      "subject": { "id": 1, "name": "Pediatrics" },
      "system": { "id": 8, "name": "Allergy & Immunology" },
      "questionBank": { "id": 1, "name": "UWorld" },
      "options": [
        {
          "id": 1,
          "textHtml": "Option A",
          "displayOrder": "A",
          "isCorrect": false,
          "explanationHtml": "Explanation for A"
        }
      ],
      "userAnswer": {
        "selectedOptionId": 2,
        "isCorrect": true,
        "timeSpentSeconds": 95,
        "answerChanges": 1
      }
    }
  ]
}
```

---

### **POST /api/tests/:id/submit**
Submit an answer to a question

**Request Body:**
```json
{
  "questionId": 1,
  "selectedOptionId": 2,
  "timeSpentSeconds": 95,
  "answerSequence": [3, 2]
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "questionId": 1,
  "testId": 1,
  "selectedOptionId": 2,
  "isCorrect": true,
  "timeSpentSeconds": 95,
  "answerChanges": 1,
  "answerSequence": [3, 2],
  "submittedAt": "2026-01-29T00:05:00.000Z"
}
```

---

### **PUT /api/tests/:id/complete**
Complete a test

**Request Body:**
```json
{
  "totalTimeSpentSeconds": 2400
}
```

**Response:**
```json
{
  "id": 1,
  "status": "completed",
  "totalQuestions": 20,
  "answeredQuestions": 20,
  "correctAnswers": 16,
  "percentageScore": 80.00,
  "timeSpentSeconds": 2400,
  "completedAt": "2026-01-29T00:40:00.000Z"
}
```

---

### **PUT /api/tests/:id/suspend**
Suspend a test without completing it

> Note: Suspend is supported only for timed tests (`type: "timed"`).

**Response:**
```json
{
  "id": 1,
  "status": "suspended",
  "timeSpentSeconds": 1250
}
```

---

### **PUT /api/tests/:id/resume**
Resume a suspended test

> Note: Resume is supported only for timed tests (`type: "timed"`).

**Response:**
```json
{
  "id": 1,
  "status": "in_progress"
}
```

---

### **GET /api/tests/:id/results**
Get detailed test results with analytics

**Response:**
```json
{
  "test": { /* full test object with questions */ },
  "analytics": {
    "overall": {
      "totalQuestions": 20,
      "answeredQuestions": 20,
      "correctAnswers": 16,
      "percentageScore": 80.00,
      "timeSpentSeconds": 2400,
      "averageTimePerQuestion": 120
    },
    "byDifficulty": [
      {
        "difficulty": "easy",
        "total": 5,
        "correct": 5,
        "percentage": "100.00"
      },
      {
        "difficulty": "medium",
        "total": 10,
        "correct": 8,
        "percentage": "80.00"
      },
      {
        "difficulty": "hard",
        "total": 5,
        "correct": 3,
        "percentage": "60.00"
      }
    ],
    "bySubject": [ /* similar breakdown */ ],
    "bySystem": [ /* similar breakdown */ ]
  }
}
```

---

## 🎨 Test Types

### **Tutor Mode** (`type: "tutor"`)
- See answers immediately after submission
- Best for learning and reviewing concepts
- No time pressure

### **Timed Mode** (`type: "timed"`)
- Exam simulation
- Answers shown only after completion
- Time-based performance tracking

### **Custom Mode** (`type: "custom"`)
- Flexible settings
- User-defined rules

---

## 🔍 Test Modes (Question Selection)

### **All** (`mode: "all"`)
- Random selection from all available questions

### **Unused** (`mode: "unused"`)
- Only questions the user has never answered
- Perfect for covering new material

### **Incorrect** (`mode: "incorrect"`)
- Only previously incorrect questions
- Ideal for targeted review

### **Marked** (`mode: "marked"`)
- Only questions the user has flagged for review
- Great for revisiting challenging topics

### **Omitted** (`mode: "omitted"`)
- Only questions left unanswered when a previous test was completed
- Best for revisiting missed/omitted items

---

## 📊 Behavioral Analytics

The system tracks:
- **Answer Changes**: How many times the user changed their answer
- **Answer Sequence**: The order of options selected (e.g., [3, 2, 4, 2])
- **Time Spent**: Total time on each question
- **Confidence Scoring**: Calculated based on answer changes and timing
- **Performance Categories**: strong, moderate, weak, guessed

This data is stored in `QuestionSubmission` and `QuestionInteraction` entities.

---

## 🔐 Security

- All endpoints require JWT authentication
- Users can only access their own tests
- Test ownership is verified on every operation
- Foreign key constraints prevent data inconsistencies

---

## 🚀 Next Steps

1. **Frontend Integration**: Build UI for test creation and taking
2. **Real-time Progress**: Add WebSocket support for live updates
3. **Pause/Resume**: Allow users to pause and resume tests
4. **Review Mode**: Let users review completed tests question-by-question
5. **Performance Graphs**: Visualize analytics with charts
6. **Spaced Repetition**: Suggest questions based on forgetting curve

---

## 📝 Example Usage Flow

1. **User creates a test**:
   ```
   POST /api/tests
   { title: "My Test", type: "tutor", mode: "unused", step: 1, totalQuestions: 20 }
   ```

2. **User gets the test**:
   ```
   GET /api/tests/1
   ```

3. **User answers questions**:
   ```
   POST /api/tests/1/submit
   { questionId: 1, selectedOptionId: 2, timeSpentSeconds: 95, answerSequence: [3, 2] }
   ```

4. **User completes the test**:
   ```
   PUT /api/tests/1/complete
   { totalTimeSpentSeconds: 2400 }
   ```

5. **User views results**:
   ```
   GET /api/tests/1/results
   ```

---

## ✅ Status

**All backend logic is complete and ready for testing!**

The backend will automatically create the new tables (`tests`, `test_questions`) when it restarts.
