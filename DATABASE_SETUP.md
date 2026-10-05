# Database Setup Guide

## PostgreSQL Installation

### Windows

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download the installer for Windows

2. **Install PostgreSQL**
   - Run the installer
   - Set a password for the postgres user (remember this!)
   - Default port: 5432
   - Complete the installation

3. **Verify Installation**
   ```bash
   psql --version
   ```

### Create Database

1. **Open PostgreSQL Command Line (psql)**
   - Search for "SQL Shell (psql)" in Windows Start Menu
   - Or use pgAdmin 4

2. **Login as postgres user**
   ```
   Server: localhost
   Database: postgres
   Port: 5432
   Username: postgres
   Password: [your password]
   ```

3. **Create the database**
   ```sql
   CREATE DATABASE medpark;
   ```

4. **Verify database creation**
   ```sql
   \l
   ```
   You should see `medpark` in the list.

5. **Connect to the database**
   ```sql
   \c medpark
   ```

## Database Configuration

1. **Update .env file**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_postgres_password
   DB_DATABASE=medpark
   ```

2. **Test Connection**
   - Start the NestJS application
   - If connection is successful, you'll see:
     ```
     🚀 Application is running on: http://localhost:3000
     ```

## Database Tables

The application will automatically create the following tables when you start it in development mode (synchronize: true):

### 1. users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  country VARCHAR(2) NOT NULL,
  rating INTEGER DEFAULT 1200,
  max_rating INTEGER DEFAULT 1200,
  rating_tier VARCHAR(20) DEFAULT 'Intern',
  contests_participated INTEGER DEFAULT 0,
  subscription_plan VARCHAR(20) DEFAULT 'Free',
  subscription_expiry TIMESTAMP,
  refresh_token VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### 2. user_preferences
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'dark',
  email_notifications BOOLEAN DEFAULT true,
  contest_reminders BOOLEAN DEFAULT true,
  default_step INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL service is running
- Check if port 5432 is not blocked by firewall
- Verify credentials in .env file

### Authentication Failed
- Double-check password in .env file
- Ensure postgres user has correct permissions

### Database Does Not Exist
- Create the database using the steps above
- Ensure database name in .env matches the created database

### Permission Denied
```sql
GRANT ALL PRIVILEGES ON DATABASE medpark TO postgres;
```

## Useful PostgreSQL Commands

```sql
-- List all databases
\l

-- Connect to database
\c medpark

-- List all tables
\dt

-- Describe table structure
\d users

-- View all users
SELECT * FROM users;

-- Drop database (careful!)
DROP DATABASE medpark;

-- Create new database
CREATE DATABASE medpark;
```

## pgAdmin 4 (GUI Alternative)

1. Open pgAdmin 4
2. Right-click on "Databases"
3. Create > Database
4. Name: medpark
5. Owner: postgres
6. Save

## Backup and Restore

### Backup
```bash
pg_dump -U postgres medpark > medpark_backup.sql
```

### Restore
```bash
psql -U postgres medpark < medpark_backup.sql
```
