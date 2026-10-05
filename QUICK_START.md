# Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Setup PostgreSQL Database

1. **Install PostgreSQL** (if not already installed)
   - Download from: https://www.postgresql.org/download/

2. **Create Database**
   ```sql
   CREATE DATABASE medpark;
   ```

3. **Update .env file**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_DATABASE=medpark
   ```

### Step 3: Start the Server
```bash
npm run start:dev
```

You should see:
```
🚀 Application is running on: http://localhost:3000
📚 Swagger documentation: http://localhost:3000/api/docs
```

### Step 4: Test the API

#### Option 1: Using Swagger UI
1. Open http://localhost:3000/api/docs
2. Try the `/api/auth/register` endpoint
3. Copy the token from the response
4. Click "Authorize" button and paste the token
5. Try other endpoints

#### Option 2: Using Postman
1. Import `MedPark-API.postman_collection.json`
2. Send "Register User" request
3. Token will be automatically saved
4. Try other requests

#### Option 3: Using cURL

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "country": "US"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Get Current User:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📝 Available Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user (requires auth)
- `GET /api/auth/me` - Get current user (requires auth)

### User Profile
- `PUT /api/users/profile` - Update profile (requires auth)
- `GET /api/users/preferences` - Get preferences (requires auth)
- `PUT /api/users/preferences` - Update preferences (requires auth)

## 🔧 Common Issues

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Check credentials in `.env` file
- Verify database exists: `CREATE DATABASE medpark;`

### "Port 3000 already in use"
- Change PORT in `.env` file
- Or kill the process using port 3000

### "JWT_SECRET is not defined"
- Ensure `.env` file exists
- Copy from `.env.example` if needed

## 📚 Next Steps

1. ✅ Authentication & User Management (DONE)
2. ⏳ Question Banks & Tests (TODO)
3. ⏳ Performance & Analytics (TODO)
4. ⏳ Contest System (TODO)
5. ⏳ Global Leaderboard (TODO)
6. ⏳ Medical Library (TODO)
7. ⏳ Notes & Flashcards (TODO)

## 🎯 Testing Checklist

- [ ] Register a new user
- [ ] Login with credentials
- [ ] Get current user info
- [ ] Update user profile
- [ ] Get user preferences
- [ ] Update user preferences
- [ ] Logout user
- [ ] Try accessing protected route without token (should fail)
- [ ] Try registering with existing email (should fail)
- [ ] Try login with wrong password (should fail)

## 💡 Tips

1. **Auto-save token**: Use Postman collection for automatic token management
2. **View logs**: Check terminal for detailed error messages
3. **Database GUI**: Use pgAdmin 4 for visual database management
4. **API docs**: Swagger UI provides interactive API documentation

## 🆘 Need Help?

- Check `README.md` for detailed documentation
- See `DATABASE_SETUP.md` for database configuration
- Review error messages in terminal
- Check Swagger docs at http://localhost:3000/api/docs
