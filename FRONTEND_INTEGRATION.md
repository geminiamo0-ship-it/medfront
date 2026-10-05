# Frontend-Backend Integration Guide

## ✅ Changes Made to Frontend

### 1. **Created API Service** (`src/utils/api.ts`)
   - Axios instance with base URL configuration
   - Request interceptor for automatic token injection
   - Response interceptor for handling 401 errors
   - Typed API endpoints for all auth and user operations

### 2. **Updated Auth Utility** (`src/utils/auth.ts`)
   - Replaced mock functions with real API calls
   - Proper token management in localStorage
   - Error handling and user data persistence
   - Support for async operations

### 3. **Added Axios Dependency**
   - Added `axios` to package.json
   - Run `npm install` to install it

## 🚀 How to Test the Integration

### Step 1: Start the Backend
```bash
cd MedPark-Backend
npm run start:dev
```

**Expected Output:**
```
🚀 Application is running on: http://localhost:3000
📚 Swagger documentation: http://localhost:3000/api/docs
```

### Step 2: Start the Frontend
```bash
cd MedPark-Frontend
npm run dev
```

**Expected Output:**
```
VITE v7.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Step 3: Test Registration Flow

1. **Open Frontend**: http://localhost:5173
2. **Navigate to Register Page**
3. **Fill in the form:**
   - Name: John Doe
   - Email: john@example.com
   - Password: SecurePass123!
   - Country: US (or any 2-letter code)

4. **Click Register**

**What Should Happen:**
- ✅ Backend receives the request
- ✅ User is created in PostgreSQL database
- ✅ JWT token is returned
- ✅ Token is stored in localStorage
- ✅ User is redirected to dashboard/home
- ✅ User data is available in the app

**Check Backend Console:**
```
[Nest] INFO [TypeOrmModule] User Repository has been initialized
```

**Check Browser Console:**
```javascript
// Should see the token stored
localStorage.getItem('authToken')
// Should see user data
localStorage.getItem('userData')
```

### Step 4: Test Login Flow

1. **Logout** (if logged in)
2. **Navigate to Login Page**
3. **Enter credentials:**
   - Email: john@example.com
   - Password: SecurePass123!

4. **Click Login**

**What Should Happen:**
- ✅ Backend validates credentials
- ✅ JWT token is returned
- ✅ User data is fetched and stored
- ✅ User is redirected to dashboard

### Step 5: Test Protected Routes

1. **While logged in**, navigate to any protected page
2. **Token should be automatically sent** in Authorization header
3. **Backend should validate** and return data

**Check Network Tab:**
```
Request Headers:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 6: Test Logout

1. **Click Logout**

**What Should Happen:**
- ✅ Logout API is called
- ✅ All localStorage data is cleared
- ✅ User is redirected to login page
- ✅ Accessing protected routes should fail

## 🔍 Debugging Tips

### Backend Not Starting?
```bash
# Check if PostgreSQL is running
# Windows: Services → PostgreSQL

# Check database exists
psql -U postgres -c "\l"

# Check .env file
cat .env
```

### Frontend API Calls Failing?

**1. Check CORS:**
Backend `.env` should have:
```env
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

**2. Check API URL:**
Frontend `.env` should have:
```env
VITE_API_URL=http://localhost:3000/api
```

**3. Check Network Tab:**
- Open DevTools → Network
- Look for failed requests
- Check response status and error message

### Common Errors and Solutions

#### Error: "Cannot connect to database"
**Solution:**
```bash
# Start PostgreSQL service
# Create database
psql -U postgres -c "CREATE DATABASE medpark;"
```

#### Error: "Email already exists"
**Solution:**
- User already registered
- Use different email or login instead

#### Error: "Invalid credentials"
**Solution:**
- Check password is correct
- Password must have uppercase, lowercase, and number

#### Error: "CORS policy blocked"
**Solution:**
- Add frontend URL to backend CORS_ORIGIN in .env
- Restart backend server

#### Error: "Network Error"
**Solution:**
- Ensure backend is running on port 3000
- Check firewall settings
- Verify API_URL in frontend .env

## 📊 Testing Checklist

### Registration
- [ ] Can register with valid data
- [ ] Cannot register with existing email
- [ ] Cannot register with weak password
- [ ] Cannot register with invalid country code
- [ ] Token is stored after registration
- [ ] User is redirected after registration

### Login
- [ ] Can login with correct credentials
- [ ] Cannot login with wrong password
- [ ] Cannot login with non-existent email
- [ ] Token is stored after login
- [ ] User data is fetched and stored
- [ ] User is redirected after login

### Protected Routes
- [ ] Can access when logged in
- [ ] Cannot access when logged out
- [ ] Token is sent in headers
- [ ] Redirected to login when token invalid

### Logout
- [ ] Logout API is called
- [ ] All localStorage is cleared
- [ ] Redirected to login page
- [ ] Cannot access protected routes after logout

## 🛠️ API Endpoints Available

### Authentication
```typescript
// Register
POST /api/auth/register
Body: { name, email, password, country }

// Login
POST /api/auth/login
Body: { email, password }

// Get Current User
GET /api/auth/me
Headers: { Authorization: Bearer <token> }

// Logout
POST /api/auth/logout
Headers: { Authorization: Bearer <token> }
```

### User Management
```typescript
// Update Profile
PUT /api/users/profile
Headers: { Authorization: Bearer <token> }
Body: { name?, country? }

// Get Preferences
GET /api/users/preferences
Headers: { Authorization: Bearer <token> }

// Update Preferences
PUT /api/users/preferences
Headers: { Authorization: Bearer <token> }
Body: { theme?, emailNotifications?, contestReminders?, defaultStep? }
```

## 📝 Example Usage in Frontend Components

### Using the Auth Functions
```typescript
import { login, register, logout, getUser } from '@/utils/auth';

// In your Login component
const handleLogin = async (email: string, password: string) => {
  try {
    await login(email, password);
    navigate('/dashboard');
  } catch (error) {
    setError(error.message);
  }
};

// In your Register component
const handleRegister = async (name: string, email: string, password: string, country: string) => {
  try {
    await register(name, email, password, country);
    navigate('/dashboard');
  } catch (error) {
    setError(error.message);
  }
};

// In your Header component
const handleLogout = async () => {
  await logout();
  navigate('/login');
};

// Get current user
const user = getUser();
console.log(user?.name); // "John Doe"
```

### Using the API Directly
```typescript
import { userApi } from '@/utils/api';

// Update profile
const updateProfile = async () => {
  try {
    const response = await userApi.updateProfile({
      name: 'John Doe Updated',
      country: 'CA'
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
};
```

## ⏸️ Timed Test Suspend/Resume (Secure)

Use backend time only. Do not send elapsed seconds from frontend.

### API Methods (`src/utils/api.ts`)
```typescript
import axios from 'axios';

export const testApi = {
  getTest: (id: number) => axios.get(`/tests/${id}`),
  suspendTest: (id: number) => axios.put(`/tests/${id}/suspend`), // no body
  resumeTest: (id: number) => axios.put(`/tests/${id}/resume`),
  completeTest: (id: number, totalTimeSpentSeconds: number) =>
    axios.put(`/tests/${id}/complete`, { totalTimeSpentSeconds }),
};
```

### UI Rules
- Show `Suspend` only when `test.type === 'timed'`.
- On click `Suspend`, call `PUT /tests/:id/suspend` with no body.
- After suspend success, stop local timer and show paused screen.
- On resume, call `PUT /tests/:id/resume`, then continue test.

### React Handlers Example
```typescript
const handleSuspend = async (testId: number, testType: 'timed' | 'tutor' | 'custom') => {
  if (testType !== 'timed') return; // timed only
  try {
    await testApi.suspendTest(testId);
    setIsSuspended(true);
    setTimerRunning(false);
  } catch (error: any) {
    const message = error?.response?.data?.message ?? 'Failed to suspend test';
    alert(message);
  }
};

const handleResume = async (testId: number) => {
  try {
    await testApi.resumeTest(testId);
    setIsSuspended(false);
    setTimerRunning(true);
  } catch (error: any) {
    const message = error?.response?.data?.message ?? 'Failed to resume test';
    alert(message);
  }
};
```

### Expected Backend Errors to Handle
- `Suspend is only supported for timed tests`
- `Resume is only supported for timed tests`
- `Test time limit has expired. Test has been automatically submitted.`

## 🎯 Next Steps

After testing authentication:
1. ✅ Verify all auth flows work
2. ⏳ Implement Question Banks module
3. ⏳ Implement Performance Analytics
4. ⏳ Implement Contest System
5. ⏳ Implement Leaderboard
6. ⏳ Implement Medical Library
7. ⏳ Implement Notes & Flashcards

## 📞 Support

If you encounter any issues:
1. Check backend console for errors
2. Check browser console for errors
3. Check Network tab for failed requests
4. Verify database connection
5. Verify environment variables
6. Check Swagger docs: http://localhost:3000/api/docs
