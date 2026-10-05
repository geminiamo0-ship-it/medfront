import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import * as bcrypt from "bcryptjs";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
  MODERATOR = "moderator",
  MARKETER = "marketer",
  SUPPORT = "support",
}

export enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
}

export enum RatingTier {
  STUDENT = "Student",
  INTERN = "Intern",
  RESIDENT = "Resident",
  ATTENDING = "Attending",
  CHIEF = "Chief",
  DIRECTOR = "Director",
}

export enum SubscriptionPlan {
  FREE = "Free",
  BASIC = "Basic",
  PREMIUM = "Premium",
}

@Entity("users")
@Index(["email"], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: "varchar", length: 50, nullable: true, unique: true })
  nickname: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "boolean", default: false, name: "is_email_verified" })
  isEmailVerified: boolean;

  @Column({ type: "timestamp", nullable: true, name: "email_verified_at" })
  emailVerifiedAt: Date | null;

  @Column({
    type: "enum",
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  @Column({ type: "varchar", length: 255, nullable: true, unique: true })
  googleId: string | null;

  @Column({ type: "varchar", length: 255, select: false })
  password: string;

  @Column({ type: "boolean", default: true, name: "has_local_password" })
  hasLocalPassword: boolean;

  @Column({ type: "date", nullable: true })
  dateOfBirth: Date;

  @Column({ type: "varchar", length: 2 })
  country: string;

  @Column({ type: "varchar", length: 20, unique: true })
  phoneNumber: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  telegramUsername: string;

  @Column({ type: "int", default: 1200 })
  rating: number;

  @Column({ type: "int", default: 1200 })
  maxRating: number;

  @Column({
    type: "enum",
    enum: RatingTier,
    default: RatingTier.INTERN,
  })
  ratingTier: RatingTier;

  @Column({ type: "int", default: 0 })
  contestsParticipated: number;

  @Column({
    type: "enum",
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  subscriptionPlan: SubscriptionPlan;

  @Column({ type: "timestamp", nullable: true })
  subscriptionExpiry: Date;

  @Column({
    type: "timestamp",
    nullable: true,
    name: "subscription_start_date",
  })
  subscriptionStartDate: Date;

  @Column({ type: "timestamp", nullable: true, name: "trial_start_date" })
  trialStartDate: Date;

  @Column({ type: "timestamp", nullable: true, name: "trial_end_date" })
  trialEndDate: Date;

  @Column({ type: "boolean", default: false, name: "has_used_trial" })
  hasUsedTrial: boolean;

  @Column({ type: "varchar", length: 500, nullable: true })
  refreshToken: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "int", default: 0 })
  resetCount: number;

  @Column({ type: "timestamp", nullable: true })
  lastLoginAt: Date;

  @Column({ type: "int", default: 0, name: "login_streak" })
  loginStreak: number;

  @Column({ type: "int", default: 0, name: "longest_login_streak" })
  longestLoginStreak: number;

  @Column({ type: "int", default: 0, name: "question_streak" })
  questionStreak: number;

  @Column({ type: "int", default: 0, name: "longest_question_streak" })
  longestQuestionStreak: number;

  @Column({ type: "date", nullable: true, name: "last_question_date" })
  lastQuestionDate: string | null;

  // Profile Fields
  @Column({ type: "varchar", length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: "text", nullable: true })
  bio: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  institution: string;

  @Column({ type: "int", nullable: true })
  graduationYear: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  specialization: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  linkedinUrl: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  githubUrl: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  portfolioUrl: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  location: string;

  // Privacy Settings
  @Column({ type: "boolean", default: true })
  isProfilePublic: boolean;

  @Column({ type: "boolean", default: false })
  showEmail: boolean;

  @Column({ type: "boolean", default: true })
  showInstitution: boolean;

  @Column({ type: "boolean", default: true })
  showContestHistory: boolean;

  @Column({ type: "varchar", length: 100, nullable: true, name: "heard_about_us_from" })
  heardAboutUsFrom: string;

  // Affiliate Program Fields
  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    unique: true,
    name: "affiliate_code",
  })
  affiliateCode: string | null;

  @Column({ type: "int", default: 5, name: "affiliate_discount_percent" })
  affiliateDiscountPercent: number;

  @Column({ type: "int", default: 5, name: "affiliate_commission_percent" })
  affiliateCommissionPercent: number;

  @Column({ type: "int", nullable: true, name: "referred_by_user_id" })
  referredByUserId: number | null;

  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    name: "applied_referral_code",
  })
  appliedReferralCode: string | null;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt: Date;

  // Hash password before insert
  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    if (this.password && !this.password.startsWith("$2b$")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  // Hash password before update if it was changed
  @BeforeUpdate()
  async hashPasswordBeforeUpdate() {
    // Check if password starts with bcrypt prefix, if so it's already hashed
    // Note: This is a simple check, in production you might want a more robust way
    // or set a flag like isPasswordChanged
    if (this.password && !this.password.startsWith("$2b$")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  // Method to validate password
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  // Method to calculate rating tier based on rating
  updateRatingTier(): void {
    if (this.rating >= 2400) {
      this.ratingTier = RatingTier.DIRECTOR;
    } else if (this.rating >= 1900) {
      this.ratingTier = RatingTier.CHIEF;
    } else if (this.rating >= 1600) {
      this.ratingTier = RatingTier.ATTENDING;
    } else if (this.rating >= 1400) {
      this.ratingTier = RatingTier.RESIDENT;
    } else if (this.rating >= 1200) {
      this.ratingTier = RatingTier.INTERN;
    } else {
      this.ratingTier = RatingTier.STUDENT;
    }
  }

  // Update max rating if current rating exceeds it
  updateMaxRating(): void {
    if (this.rating > this.maxRating) {
      this.maxRating = this.rating;
    }
  }
}
