# 🗺️ Backend Integration Roadmap

## 1. ✅ Fix: Login Loop Resolved
**Status:** Completed
- **Issue:** User stuck in redirect loop on login failure.
- **Fix:** Updated frontend interceptor and login page to handle errors gracefully.

## 2. ✅ User Roles Implementation
**Status:** Completed
- **Implemented:** `UserRole` enum (User, Admin, Marketer, etc.) added to Database.
- **Security:** `RolesGuard` and `@Roles()` decorator created for protecting routes.
- **Auth:** Login/Register now return user role.

---

## 3. 🧠 The "Brain" (Next Priority) - Question Bank Module
The app is currently "empty" beyond logging in. We need data!

### **Why this is next?**
- You cannot create a test without Questions.
- You cannot have a Contest without Questions.
- You cannot track Performance without Questions.

### **Implementation Plan:**
1.  **Entities:**
    - `Subject` (e.g., Pathology, Pharmacology)
    - `System` (e.g., Cardiovascular, Respiratory)
    - `Question` (The actual content, difficulty, type)
    - `Answer` (Options, correct flag, explanation)
2.  **API Endpoints:**
    - `GET /questions` (Filter by subject, system, difficulty)
    - `POST /questions` (Admin only: Add new questions)
    - `POST /questions/:id/submit` (Check answer)

---

## 4. 🏆 Contest Module (Future)
Once we have questions, we can build Contests.
- **Entities:** `Contest`, `ContestParticipant`, `ContestSubmission`
- **Features:** Leaderboard calculation, Timed events.

## 5. 💳 Subscription & Payments (Future)
- **Status:** Basic fields exist. Logic needed for upgrades/downgrades.
