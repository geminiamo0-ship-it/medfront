# 🌱 Database Seeding Guide

## Overview
This guide explains how to seed the MedPark database with initial data including subjects, systems, topics, question banks, sample questions, users, and contests.

---

## 📋 Prerequisites

1. **Database Running**: Ensure PostgreSQL is running
2. **Environment Variables**: `.env` file configured with database credentials
3. **Dependencies Installed**: Run `npm install`

---

## 🚀 Quick Start

### **Option 1: Automatic Seeding (Development Mode)**

If `synchronize: true` in `app.module.ts`, the tables will be created automatically when you start the server:

```bash
npm run start:dev
```

Then run the seed script:

```bash
npm run seed
```

### **Option 2: Manual Migration + Seeding (Production-like)**

1. **Generate Migration** (if needed):
```bash
npm run migration:generate -- src/database/migrations/InitialSchema
```

2. **Run Migration**:
```bash
npm run migration:run
```

3. **Seed Database**:
```bash
npm run seed
```

---

## 📊 What Gets Seeded

### **1. Subjects (6 items)**
- Pediatrics
- Internal Medicine
- Surgery
- Obstetrics & Gynecology
- Psychiatry
- Neurology

### **2. Systems (9 items)**
- Cardiovascular ❤️
- Respiratory 🫁
- Gastrointestinal 🍽️
- Renal & Urinary 💧
- Musculoskeletal 🦴
- Endocrine ⚗️
- Hematology & Oncology 🩸
- Allergy & Immunology 🛡️
- Infectious Disease 🦠

### **3. Topics (3 sample items)**
- Immune deficiencies
- Congenital heart disease
- Developmental milestones

### **4. Question Banks (3 items)**
- **UWorld** - 3,645 questions (Premium)
- **NBME** - 800 questions (Premium)
- **Amboss** - 2,500 questions (Premium)

### **5. Questions (2 real examples from your SQL)**
- **Question 1**: Chronic Granulomatous Disease
  - Full HTML content with tables
  - 5 answer options with explanations
  - Metadata: Pediatrics, Immunology, Hard difficulty
  
- **Question 2**: Severe Combined Immunodeficiency (SCID)
  - Full HTML content
  - 5 answer options with explanations
  - Metadata: Pediatrics, Immunology, Medium difficulty

### **6. Users (3 accounts)**

| Email | Password | Role | Subscription |
|-------|----------|------|--------------|
| admin@medpark.com | password123 | Super Admin | Premium |
| student@medpark.com | password123 | User | Basic |
| premium@medpark.com | password123 | User | Premium |

### **7. Contests (2 items)**
- **Weekly Pediatrics Challenge** (Registration Open)
  - 20 questions, 40 minutes
  - Open to all users
  - Prize: 1 month Premium for top 3
  
- **Speed Round: Immunology** (Draft)
  - 15 questions, 20 minutes
  - Premium users only
  - Speed-based scoring

---

## 🔧 Customizing Seed Data

### **Adding More Questions**

Edit `src/database/seed.ts` and add questions in the Questions section:

```typescript
const question3 = await questionRepo.save({
  questionBankId: uworldBank.id,
  externalId: 'YOUR_ID',
  textHtml: '<p>Your question text...</p>',
  explanationHtml: '<p>Your explanation...</p>',
  subjectId: pediatrics.id,
  systemId: immunology.id,
  topicId: immunoDefTopic.id,
  difficulty: QuestionDifficulty.MEDIUM,
  step: USMLEStep.STEP_1,
  source: 'uworld',
  // ... other fields
});

await optionRepo.save([
  {
    questionId: question3.id,
    textHtml: 'Option A text',
    isCorrect: false,
    displayOrder: 'A',
  },
  // ... more options
]);
```

### **Adding More Subjects/Systems**

Add to the respective arrays in `seed.ts`:

```typescript
const subjects = await subjectRepo.save([
  // ... existing subjects
  {
    name: 'Radiology',
    code: 'RAD',
    description: 'Medical imaging',
    icon: '🔬',
    displayOrder: 7,
    isActive: true,
  },
]);
```

---

## 🗑️ Resetting the Database

### **Option 1: Drop and Recreate (Development)**

```bash
# Connect to PostgreSQL
psql -U your_username -d postgres

# Drop and recreate database
DROP DATABASE medpark;
CREATE DATABASE medpark;
\q

# Run seed
npm run seed
```

### **Option 2: Revert Migrations**

```bash
npm run migration:revert
npm run migration:run
npm run seed
```

---

## ✅ Verification

After seeding, verify the data:

```sql
-- Check subjects
SELECT COUNT(*) FROM subjects;  -- Should be 6

-- Check systems
SELECT COUNT(*) FROM systems;   -- Should be 9

-- Check questions
SELECT COUNT(*) FROM questions; -- Should be 2

-- Check users
SELECT email, role, subscription_plan FROM users;

-- Check contests
SELECT title, status FROM contests;

-- Check question with options
SELECT 
  q.text_html,
  COUNT(qo.id) as option_count
FROM questions q
LEFT JOIN question_options qo ON qo.question_id = q.id
GROUP BY q.id, q.text_html;
```

---

## 🐛 Troubleshooting

### **Error: "relation does not exist"**
- Tables haven't been created yet
- Solution: Run `npm run start:dev` first (with `synchronize: true`) or run migrations

### **Error: "duplicate key value"**
- Data already exists
- Solution: Drop and recreate database, or modify seed script to check for existing data

### **Error: "Cannot find module"**
- TypeScript compilation issue
- Solution: Run `npm run build` first

### **Seed runs but no data appears**
- Check database connection in `.env`
- Verify you're connected to the correct database
- Check for errors in the seed output

---

## 📝 Seed Script Output

When you run `npm run seed`, you should see:

```
🔌 Connecting to database...
✅ Database connected!

🌱 Running seed script...

📚 Seeding Subjects...
✅ Created 6 subjects
🫀 Seeding Systems...
✅ Created 9 systems
📖 Seeding Topics...
✅ Created 3 topics
📦 Seeding Question Banks...
✅ Created 3 question banks
❓ Seeding Questions...
✅ Created 2 sample questions with options
👥 Seeding Users...
✅ Created 3 users with preferences
🏆 Seeding Contests...
✅ Created 2 contests

🎉 Database seeding completed successfully!
═══════════════════════════════════════════
📚 Subjects: 6
🫀 Systems: 9
📖 Topics: 3
📦 Question Banks: 3
❓ Questions: 2 (with full HTML content)
👥 Users: 3
🏆 Contests: 2
═══════════════════════════════════════════

💡 Test Credentials:
   Admin: admin@medpark.com / password123
   Student: student@medpark.com / password123
   Premium: premium@medpark.com / password123

✨ Ready to start building! ✨
```

---

## 🚀 Next Steps

After seeding:

1. **Test Login**: Use one of the seeded accounts to log in
2. **View Questions**: Navigate to question bank to see the 2 sample questions
3. **Join Contest**: Register for the "Weekly Pediatrics Challenge"
4. **Add More Data**: Customize the seed script to add your own questions
5. **Build API Endpoints**: Create controllers to expose this data

---

## 📚 Related Documentation

- `DATABASE_ARCHITECTURE.md` - Complete entity design
- `BEHAVIORAL_ANALYTICS_GUIDE.md` - How tracking works
- `ENTITIES_COMPLETE_SUMMARY.md` - Entity overview

---

**Happy Seeding! 🌱**
