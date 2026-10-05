# MedPark Backend API

A comprehensive NestJS backend for the MedPark medical education platform with PostgreSQL database.

## 🚀 Features

### Authentication & User Management (Implemented)
- ✅ User Registration with validation
- ✅ User Login with JWT authentication
- ✅ Logout functionality
- ✅ Get current user information
- ✅ Update user profile
- ✅ User preferences management
- ✅ Password hashing with bcrypt
- ✅ JWT token-based authentication
- ✅ Rating tier system (Student, Intern, Resident, Attending, Chief, Director)
- ✅ Subscription management (Free, Basic, Premium)

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
```bash
cd MedPark-Backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=medpark
JWT_SECRET=your-super-secret-jwt-key
```

4. **Create PostgreSQL database**
```sql
CREATE DATABASE medpark;
```

5. **Run the application**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 📚 API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:3000/api/docs

## 🔐 Authentication Endpoints

### 1. Register User
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "country": "US"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "country": "US",
    "rating": 1200,
    "ratingTier": "Intern",
    "token": "jwt_token"
  }
}
```

### 2. Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "country": "US",
    "rating": 1654,
    "ratingTier": "Resident",
    "maxRating": 1702,
    "subscriptionPlan": "Premium",
    "subscriptionExpiry": "2026-02-03T03:40:00Z",
    "token": "jwt_token"
  }
}
```

### 3. Get Current User
**GET** `/api/auth/me`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "country": "US",
    "rating": 1654,
    "ratingTier": "Resident",
    "maxRating": 1702,
    "contestsParticipated": 12,
    "subscriptionPlan": "Premium",
    "subscriptionExpiry": "2026-02-03T03:40:00Z",
    "createdAt": "2025-10-15T10:00:00Z"
  }
}
```

### 4. Logout
**POST** `/api/auth/logout`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## 👤 User Profile Endpoints

### 1. Update Profile
**PUT** `/api/users/profile`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "country": "CA"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "userId": "uuid",
    "name": "John Doe Updated",
    "country": "CA"
  }
}
```

### 2. Get Preferences
**GET** `/api/users/preferences`

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "theme": "dark",
    "emailNotifications": true,
    "contestReminders": true,
    "defaultStep": 1
  }
}
```

### 3. Update Preferences
**PUT** `/api/users/preferences`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "theme": "light",
  "emailNotifications": false,
  "contestReminders": true,
  "defaultStep": 2
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    "theme": "light",
    "emailNotifications": false,
    "contestReminders": true,
    "defaultStep": 2
  }
}
```

## 🗄️ Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `email` (VARCHAR, Unique)
- `password` (VARCHAR, Hashed)
- `country` (VARCHAR)
- `rating` (INT)
- `maxRating` (INT)
- `ratingTier` (ENUM)
- `contestsParticipated` (INT)
- `subscriptionPlan` (ENUM)
- `subscriptionExpiry` (TIMESTAMP)
- `refreshToken` (VARCHAR)
- `isActive` (BOOLEAN)
- `lastLoginAt` (TIMESTAMP)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

### User Preferences Table
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `theme` (ENUM: light/dark)
- `emailNotifications` (BOOLEAN)
- `contestReminders` (BOOLEAN)
- `defaultStep` (INT)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

## 🔒 Security Features

1. **Password Security**
   - Bcrypt hashing with salt rounds of 10
   - Password strength validation (uppercase, lowercase, number/special char)
   - Minimum 8 characters

2. **JWT Authentication**
   - Secure token generation
   - Token expiration (7 days default)
   - Bearer token authentication

3. **Input Validation**
   - Class-validator for DTO validation
   - Email format validation
   - Country code validation (ISO 2-letter codes)

4. **Database Security**
   - Password field excluded from default queries
   - Prepared statements (TypeORM)
   - SQL injection prevention

## 🎯 Rating Tier System

| Tier | Rating Range | Color |
|------|-------------|-------|
| Student | 0 - 1199 | #808080 |
| Intern | 1200 - 1399 | #008000 |
| Resident | 1400 - 1599 | #03a89e |
| Attending | 1600 - 1899 | #0000ff |
| Chief | 1900 - 2399 | #aa00aa |
| Director | 2400+ | #ff8c00 |

## 📝 Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["field1", "field2"],
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes
- `200 OK`: Successful GET, PUT, DELETE
- `201 Created`: Successful POST
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource (e.g., email exists)
- `500 Internal Server Error`: Server error

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Project Structure

```
src/
├── auth/
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   └── auth.service.ts
├── users/
│   ├── dto/
│   │   ├── update-profile.dto.ts
│   │   └── update-preferences.dto.ts
│   ├── users.controller.ts
│   ├── users.module.ts
│   └── users.service.ts
├── entities/
│   ├── user.entity.ts
│   └── user-preferences.entity.ts
├── config/
│   └── typeorm.config.ts
├── app.module.ts
└── main.ts
```

## 🚧 Future Modules (To Be Implemented)

- Question Banks & Tests
- Performance & Analytics
- Contest System
- Global Leaderboard
- Medical Library
- Notes & Flashcards

## 📄 License

MIT

## 👥 Team

MedPark Development Team
