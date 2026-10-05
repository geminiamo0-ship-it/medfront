import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, SubscriptionPlan, RatingTier } from '../entities/user.entity';
import { Contest, ContestStatus, ContestType } from '../entities/contest.entity';
import { ContestParticipant, ParticipantStatus } from '../entities/contest-participant.entity';
import { USMLEStep } from '../entities/question-bank.entity';

// Codeforces-style Elo Rating System
class RatingCalculator {
  // Calculate probability that user A beats user B
  private static getProbability(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  // Calculate expected rank (seed) for a user
  private static calculateSeed(userRating: number, allRatings: number[]): number {
    let seed = 1;
    for (const otherRating of allRatings) {
      if (otherRating !== userRating) {
        seed += this.getProbability(otherRating, userRating);
      }
    }
    return seed;
  }

  // Calculate performance rating using binary search
  private static calculatePerformanceRating(
    targetRank: number,
    allRatings: number[]
  ): number {
    let left = 0;
    let right = 4000;
    
    for (let i = 0; i < 20; i++) { // 20 iterations for precision
      const mid = (left + right) / 2;
      const seed = this.calculateSeed(mid, allRatings);
      
      if (seed < targetRank) {
        right = mid;
      } else {
        left = mid;
      }
    }
    
    return Math.round((left + right) / 2);
  }

  // Calculate new rating for a user based on their performance
  static calculateNewRating(
    oldRating: number,
    actualRank: number,
    allRatings: number[]
  ): { newRating: number; delta: number } {
    const seed = this.calculateSeed(oldRating, allRatings);
    
    // Geometric mean of seed and actual rank
    const geometricMean = Math.sqrt(seed * actualRank);
    
    // Calculate performance rating
    const performanceRating = this.calculatePerformanceRating(geometricMean, allRatings);
    
    // Move rating towards performance (with dampening factor)
    const delta = Math.round((performanceRating - oldRating) / 2);
    const newRating = oldRating + delta;
    
    return { newRating, delta };
  }
}

// Generate realistic user data
const firstNames = [
  'Ahmed', 'Mohamed', 'Sarah', 'Fatima', 'Omar', 'Layla', 'Youssef', 'Nour',
  'Ali', 'Maryam', 'Hassan', 'Zainab', 'Khaled', 'Amira', 'Mahmoud', 'Hana',
  'Ibrahim', 'Yasmin', 'Mustafa', 'Salma', 'Tariq', 'Dina', 'Karim', 'Lina',
  'Rami', 'Jana', 'Sami', 'Maya', 'Fadi', 'Rana', 'Waleed', 'Nada',
  'John', 'Emma', 'Michael', 'Sophia', 'David', 'Olivia', 'James', 'Ava',
  'Robert', 'Isabella', 'William', 'Mia', 'Joseph', 'Charlotte', 'Thomas', 'Amelia',
  'Charles', 'Harper', 'Daniel', 'Evelyn', 'Matthew', 'Abigail', 'Anthony', 'Emily',
  'Mark', 'Elizabeth', 'Donald', 'Sofia', 'Steven', 'Avery', 'Paul', 'Ella',
  'Andrew', 'Scarlett', 'Joshua', 'Grace', 'Kenneth', 'Chloe', 'Kevin', 'Victoria',
  'Brian', 'Madison', 'George', 'Luna', 'Edward', 'Aria', 'Ronald', 'Lily',
  'Timothy', 'Layla', 'Jason', 'Zoey', 'Jeffrey', 'Penelope', 'Ryan', 'Riley'
];

const lastNames = [
  'Ahmed', 'Hassan', 'Ali', 'Ibrahim', 'Mohamed', 'Mahmoud', 'Youssef', 'Khalil',
  'Mansour', 'Farouk', 'Nasser', 'Samir', 'Kamal', 'Rashid', 'Hamza', 'Tariq',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
  'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
  'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
  'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter'
];

const countries = [
  'EG', 'US', 'GB', 'CA', 'AU', 'IN', 'PK', 'SA', 'AE', 'JO',
  'LB', 'SY', 'IQ', 'KW', 'QA', 'BH', 'OM', 'YE', 'MA', 'TN',
  'DZ', 'LY', 'SD', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH',
  'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'AT', 'GR', 'PT', 'IE'
];

const institutions = [
  'Cairo University', 'Harvard Medical School', 'Johns Hopkins University',
  'Stanford University', 'Oxford University', 'Cambridge University',
  'Yale University', 'Columbia University', 'University of Pennsylvania',
  'Duke University', 'Northwestern University', 'Vanderbilt University',
  'Ain Shams University', 'Alexandria University', 'Mansoura University',
  'King Saud University', 'American University of Beirut', 'University of Jordan',
  'Kuwait University', 'Qatar University', 'UAE University', 'Bahrain University',
  'Sultan Qaboos University', 'King Abdulaziz University', 'University of Toronto',
  'McGill University', 'University of Melbourne', 'University of Sydney',
  'Imperial College London', 'UCL', 'Kings College London', 'Edinburgh University'
];

const specializations = [
  'Internal Medicine', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology',
  'Psychiatry', 'Neurology', 'Cardiology', 'Oncology', 'Radiology',
  'Anesthesiology', 'Emergency Medicine', 'Family Medicine', 'Dermatology',
  'Ophthalmology', 'Orthopedics', 'Urology', 'ENT', 'Pathology'
];

const cities = [
  'Cairo', 'New York', 'London', 'Toronto', 'Sydney', 'Mumbai', 'Karachi',
  'Riyadh', 'Dubai', 'Amman', 'Beirut', 'Damascus', 'Baghdad', 'Kuwait City',
  'Doha', 'Manama', 'Muscat', 'Sanaa', 'Rabat', 'Tunis', 'Algiers', 'Tripoli',
  'Khartoum', 'Berlin', 'Paris', 'Rome', 'Madrid', 'Amsterdam', 'Brussels',
  'Zurich', 'Stockholm', 'Oslo', 'Copenhagen', 'Helsinki', 'Warsaw', 'Prague',
  'Vienna', 'Athens', 'Lisbon', 'Dublin', 'Boston', 'Chicago', 'Los Angeles'
];

function generateBio(): string {
  const templates = [
    'Medical student passionate about advancing healthcare and improving patient outcomes.',
    'Aspiring physician dedicated to evidence-based medicine and continuous learning.',
    'Future doctor committed to making a difference in global health.',
    'Medical enthusiast focused on mastering clinical knowledge and skills.',
    'Dedicated to becoming a compassionate and skilled healthcare professional.',
    'Preparing for medical licensing exams while staying updated with latest research.',
    'Passionate about medical education and helping fellow students succeed.',
    'Striving for excellence in medical practice and patient care.',
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function seedRealisticProfiles(dataSource: DataSource) {
  console.log('🌱 Starting realistic profile seeding...');

  const userRepo = dataSource.getRepository(User);
  const contestRepo = dataSource.getRepository(Contest);
  const participantRepo = dataSource.getRepository(ContestParticipant);

  console.log('👥 Creating 178 realistic user profiles...');
  const users: User[] = [];
  
  for (let i = 1; i <= 178; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@medpark.com`;
    const nickname = `${firstName.toLowerCase()}${lastName.toLowerCase()}${i}`;
    
    const user = userRepo.create({
      name,
      email,
      password: await bcrypt.hash('password123', 10),
      nickname,
      role: UserRole.USER,
      country: countries[Math.floor(Math.random() * countries.length)],
      dateOfBirth: new Date(1995 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      rating: 1200, // Starting rating
      maxRating: 1200,
      ratingTier: RatingTier.INTERN,
      contestsParticipated: 0,
      subscriptionPlan: Math.random() > 0.7 ? SubscriptionPlan.PREMIUM : SubscriptionPlan.FREE,
      isActive: true,
      // Profile fields
      bio: generateBio(),
      institution: institutions[Math.floor(Math.random() * institutions.length)],
      graduationYear: 2024 + Math.floor(Math.random() * 6),
      specialization: specializations[Math.floor(Math.random() * specializations.length)],
      location: cities[Math.floor(Math.random() * cities.length)],
      isProfilePublic: Math.random() > 0.2, // 80% public profiles
      showEmail: Math.random() > 0.7,
      showInstitution: Math.random() > 0.3,
      showContestHistory: Math.random() > 0.2,
    });
    
    users.push(user);
  }

  const savedUsers = await userRepo.save(users);
  console.log(`✅ Created ${savedUsers.length} users`);

  // Create 3 past contests
  console.log('🏆 Creating 3 past contests...');
  const now = new Date();
  
  const contests = await contestRepo.save([
    {
      title: 'Weekly Medical Challenge #1',
      description: 'Test your knowledge across multiple medical specialties',
      step: USMLEStep.STEP_2,
      type: ContestType.BALANCED,
      status: ContestStatus.COMPLETED,
      totalQuestions: 50,
      durationMinutes: 120,
      registrationOpenTime: new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000),
      startTime: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      maxParticipants: 200,
      isPublic: true,
      createdBy: savedUsers[0]?.id || 1,
    },
    {
      title: 'Grand Medical Championship',
      description: 'Compete with the best medical students worldwide',
      step: USMLEStep.STEP_2,
      type: ContestType.BALANCED,
      status: ContestStatus.COMPLETED,
      totalQuestions: 100,
      durationMinutes: 180,
      registrationOpenTime: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000),
      startTime: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      maxParticipants: 200,
      isPublic: true,
      createdBy: savedUsers[0]?.id || 1,
    },
    {
      title: 'Speed Round - Internal Medicine',
      description: 'Fast-paced questions on internal medicine',
      step: USMLEStep.STEP_2,
      type: ContestType.SPEED,
      status: ContestStatus.COMPLETED,
      totalQuestions: 40,
      durationMinutes: 60,
      registrationOpenTime: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
      startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
      maxParticipants: 200,
      isPublic: true,
      createdBy: savedUsers[0]?.id || 1,
    },
  ]);

  console.log(`✅ Created ${contests.length} contests`);

  // Simulate contest participation with Codeforces rating system
  console.log('📊 Simulating contest results with Codeforces rating system...');

  for (const contest of contests) {
    // Randomly select 120-150 participants for each contest
    const participantCount = 120 + Math.floor(Math.random() * 31);
    const shuffledUsers = [...savedUsers].sort(() => Math.random() - 0.5);
    const contestParticipants = shuffledUsers.slice(0, participantCount);

    console.log(`  Contest: ${contest.title} (${participantCount} participants)`);

    // Get all current ratings for this contest
    const currentRatings = contestParticipants.map(u => u.rating);

    // Generate realistic scores and ranks
    const participantResults = contestParticipants.map((user, index) => {
      // Score based on skill (rating) with some randomness
      const skillFactor = (user.rating - 1000) / 2000; // 0 to 1 range
      const randomFactor = Math.random() * 0.3; // 30% randomness
      const performanceFactor = skillFactor * 0.7 + randomFactor;
      
      const maxScore = contest.type === ContestType.SPEED ? 800 : 1000;
      const score = Math.round(maxScore * performanceFactor);
      
      return { user, score };
    });

    // Sort by score to determine ranks
    participantResults.sort((a, b) => b.score - a.score);

    // Calculate rating changes using Codeforces system
    const participants: ContestParticipant[] = [];
    
    for (let i = 0; i < participantResults.length; i++) {
      const { user, score } = participantResults[i];
      const rank = i + 1;
      
      // Calculate new rating
      const currentRating = Number(user.rating);
      const { newRating, delta } = RatingCalculator.calculateNewRating(
        currentRating,
        rank,
        currentRatings.map(r => Number(r))
      );

      // Update user rating
      user.rating = Math.max(0, newRating); 
      user.maxRating = Math.max(Number(user.maxRating), user.rating);
      user.contestsParticipated = Number(user.contestsParticipated) + 1;
      
      // Update rating tier
      if (user.rating >= 2400) user.ratingTier = RatingTier.DIRECTOR;
      else if (user.rating >= 1900) user.ratingTier = RatingTier.CHIEF;
      else if (user.rating >= 1600) user.ratingTier = RatingTier.ATTENDING;
      else if (user.rating >= 1400) user.ratingTier = RatingTier.RESIDENT;
      else if (user.rating >= 1200) user.ratingTier = RatingTier.INTERN;
      else user.ratingTier = RatingTier.STUDENT;

      // Create participant record
      const participant = participantRepo.create({
        contestId: contest.id,
        userId: user.id,
        status: ParticipantStatus.COMPLETED,
        registeredAt: new Date(contest.startTime.getTime() - 24 * 60 * 60 * 1000),
        startedAt: contest.startTime,
        completedAt: new Date(contest.endTime.getTime() - Math.floor(Math.random() * 30 * 60 * 1000)),
        totalScore: score,
        rank,
        timeSpentSeconds: Math.floor(Math.random() * contest.durationMinutes * 60),
        correctAnswers: Math.floor(score / 10), // Assuming 10 points per correct answer
        wrongAnswers: Math.floor(Math.random() * 5),
        oldRating: Number(user.rating) - delta,
        ratingChange: delta,
      });

      participants.push(participant);
    }

    // Save all participants for this contest
    await participantRepo.save(participants);
    console.log(`  ✅ Saved ${participants.length} participants with rating changes`);

    // Save updated user ratings
    await userRepo.save(contestParticipants);
  }

  console.log('✅ All users have participated in 3 contests with realistic ratings!');
  
  // Print statistics
  const avgRating = savedUsers.reduce((sum, u) => sum + Number(u.rating), 0) / savedUsers.length;
  const maxRatingUser = savedUsers.reduce((max, u) => Number(u.rating) > Number(max.rating) ? u : max);
  const minRatingUser = savedUsers.reduce((min, u) => Number(u.rating) < Number(min.rating) ? u : min);
  
  console.log('\n📈 Final Statistics:');
  console.log(`  Average Rating: ${Math.round(avgRating)}`);
  console.log(`  Highest Rating: ${maxRatingUser.rating} (${maxRatingUser.name})`);
  console.log(`  Lowest Rating: ${minRatingUser.rating} (${minRatingUser.name})`);
  console.log(`  Total Contests: ${contests.length}`);
  console.log(`  Total Participations: ${savedUsers.reduce((sum, u) => sum + Number(u.contestsParticipated), 0)}`);
}
