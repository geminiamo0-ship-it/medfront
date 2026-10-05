# Realistic Profile Seeding

This script generates 178 realistic user profiles with authentic contest histories using the Codeforces Elo rating system.

## What It Does

1. **Creates 178 Users** with:
   - Realistic names (mix of Arabic and Western names)
   - Random countries from 40+ countries
   - Medical institutions from top universities worldwide
   - Specializations across 18 medical fields
   - Professional bios
   - Privacy settings (80% public profiles)
   - Starting rating of 1200

2. **Creates 3 Past Contests**:
   - Weekly Medical Challenge #1 (3 weeks ago, 2 hours)
   - Grand Medical Championship (2 weeks ago, 3 hours)
   - Speed Round - Internal Medicine (1 week ago, 1 hour)

3. **Simulates Contest Participation**:
   - 120-150 random participants per contest
   - Realistic scores based on rating + randomness
   - **Codeforces Elo Rating System** for rating changes
   - Proper rank calculation
   - Rating tier updates (Student → Intern → Resident → Attending → Chief → Director)

## Codeforces Rating System

The script implements the authentic Codeforces rating algorithm:

1. **Seed Calculation**: Expected rank based on current rating vs all participants
2. **Performance Rating**: Binary search to find theoretical rating for actual performance
3. **Rating Update**: Move current rating halfway toward performance rating
4. **Geometric Mean**: Dampens extreme outliers

Formula:
```
Seed = 1 + Σ P(other beats you)
P(A > B) = 1 / (1 + 10^((R_B - R_A) / 400))
New Rating = Old Rating + (Performance Rating - Old Rating) / 2
```

## How to Run

```bash
# From the backend directory
cd MedPark-Backend

# Run the seeding script
npm run seed:profiles
```

## What You'll See

```
🌱 Starting realistic profile seeding...
🗑️  Clearing existing contest participants...
🗑️  Clearing existing contests (except active ones)...
👥 Creating 178 realistic user profiles...
✅ Created 178 users
🏆 Creating 3 past contests...
✅ Created 3 contests
📊 Simulating contest results with Codeforces rating system...
  Contest: Weekly Medical Challenge #1 (145 participants)
  ✅ Saved 145 participants with rating changes
  Contest: Grand Medical Championship (132 participants)
  ✅ Saved 132 participants with rating changes
  Contest: Speed Round - Internal Medicine (128 participants)
  ✅ Saved 128 participants with rating changes
✅ All users have participated in 3 contests with realistic ratings!

📈 Final Statistics:
  Average Rating: 1245
  Highest Rating: 1876 (Ahmed Hassan)
  Lowest Rating: 987 (Sarah Johnson)
  Total Contests: 3
  Total Participations: 405
```

## Expected Results

After seeding:
- **178 users** with varying ratings (typically 900-1900)
- **3 completed contests** with full leaderboards
- **~400 total participations** across all contests
- **Realistic rating distribution** following normal curve
- **Proper tier distribution**:
  - Student: ~15%
  - Intern: ~35%
  - Resident: ~30%
  - Attending: ~15%
  - Chief: ~4%
  - Director: ~1%

## Profile Features

Each user has:
- ✅ Name (realistic, culturally diverse)
- ✅ Email (auto-generated)
- ✅ Nickname (username)
- ✅ Country (40+ countries)
- ✅ Institution (32 top medical schools)
- ✅ Graduation year (2024-2029)
- ✅ Specialization (18 fields)
- ✅ Location (city)
- ✅ Bio (professional statement)
- ✅ Rating (calculated from contests)
- ✅ Max rating (peak performance)
- ✅ Rating tier (based on current rating)
- ✅ Contests participated (3 for all users)
- ✅ Privacy settings (randomized)

## Contest Participation

Each contest has:
- ✅ 120-150 participants
- ✅ Realistic score distribution
- ✅ Proper ranking (1st, 2nd, 3rd, etc.)
- ✅ Time spent (random within duration)
- ✅ Rating changes (Codeforces algorithm)
- ✅ Correct/wrong answer counts

## Testing the Results

After seeding, you can:

1. **View Global Leaderboard**: See all 178 users ranked by rating
2. **Click User Profiles**: View detailed profiles with contest history
3. **Check Contest Leaderboards**: See participants and their scores
4. **Verify Rating Changes**: Ratings should vary realistically

## Notes

- The script clears existing contest participants and completed contests
- Active/upcoming contests are preserved
- Admin users are not affected
- Existing user data is preserved (only adds new users)
- All passwords are set to `password123` for testing

## Troubleshooting

**Error: Database connection failed**
- Ensure PostgreSQL is running
- Check your `.env` file has correct DB credentials

**Error: Contest entity not found**
- Run migrations first: `npm run migration:run`

**Seeding takes too long**
- Normal! Creating 178 users + 400+ participations takes 30-60 seconds
- The Codeforces algorithm involves complex calculations

## Next Steps

After seeding:
1. Navigate to Global Leaderboard
2. Click on any username
3. View their profile with contest history
4. Check rating changes across contests
5. Verify the data looks realistic!
