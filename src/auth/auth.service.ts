import {
  Inject,
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  User,
  UserRole,
  RatingTier,
  SubscriptionPlan,
} from "../entities/user.entity";
import { UserPreferences, Theme } from "../entities/user-preferences.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtPayload } from "./strategies/jwt.strategy";
import * as bcrypt from "bcryptjs";
import { AffiliateService } from "../affiliate/affiliate.service";
import { SettingsService } from "../settings/settings.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { authUserCacheKey } from "../cache/cache-keys.util";
import { EmailService } from "../email/email.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreferences)
    private preferencesRepository: Repository<UserPreferences>,
    private jwtService: JwtService,
    private affiliateService: AffiliateService,
    private settingsService: SettingsService,
    private emailService: EmailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private static readonly DEFAULT_ALLOWED_DOMAINS = '["gmail.com","yahoo.com","outlook.com","hotmail.com","live.com","msn.com","icloud.com","me.com","mac.com","proton.me","protonmail.com"]';

  private async validateEmailDomain(email: string): Promise<void> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      throw new BadRequestException('Please provide a valid email address');
    }

    if (domain.endsWith('.edu')) return;

    const raw = await this.settingsService.getString(
      'ALLOWED_EMAIL_DOMAINS',
      AuthService.DEFAULT_ALLOWED_DOMAINS,
    );

    let allowedDomains: string[];
    try {
      allowedDomains = JSON.parse(raw);
    } catch {
      allowedDomains = JSON.parse(AuthService.DEFAULT_ALLOWED_DOMAINS);
    }

    if (!allowedDomains.includes(domain)) {
      throw new BadRequestException(
        'This email provider is not supported. Please use a major email provider to register.',
      );
    }
  }

  async register(registerDto: RegisterDto) {
    const {
      password,
      name,
      nickname,
      dateOfBirth,
      country,
      phoneNumber,
      university,
      heardAboutUsFrom,
    } = registerDto;

    const email = registerDto.email?.toLowerCase();

    await this.validateEmailDomain(email);

    const normalizedCountry = country ?? "ZZ";

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists");
    }

    // Check if nickname already exists (if provided)
    if (nickname) {
      const existingNickname = await this.userRepository.findOne({
        where: { nickname },
      });
      if (existingNickname) {
        throw new ConflictException("Nickname already taken");
      }
    }

    // Check if phone number already exists
    const existingPhone = await this.userRepository.findOne({
      where: { phoneNumber },
    });

    if (existingPhone) {
      throw new ConflictException("Phone number already registered");
    }

    // Create new user with trial initialization
    const now = new Date();
    const trialDays = await this.settingsService.getNumber('FREE_TRIAL_DAYS', 7);
    const trialEndDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const user = this.userRepository.create({
      email,
      password, // Will be hashed by @BeforeInsert hook
      name,
      nickname,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      country: normalizedCountry,
      phoneNumber,
      institution: university,
      heardAboutUsFrom,
      rating: 1200,
      maxRating: 1200,
      ratingTier: RatingTier.INTERN,
      subscriptionPlan: SubscriptionPlan.FREE,
      contestsParticipated: 0,
      isActive: false, // Locked until email is verified
      isEmailVerified: false,
      hasLocalPassword: true,
      // Trial initialization
      trialStartDate: now,
      trialEndDate: trialEndDate,
      hasUsedTrial: false,
    });

    const savedUser = await this.userRepository.save(user);
    await this.affiliateService.getOrCreateAffiliateCode(savedUser.id);

    // Create default preferences
    const preferences = this.preferencesRepository.create({
      userId: savedUser.id,
      theme: Theme.DARK,
      emailNotifications: true,
      contestReminders: true,
      defaultStep: 1,
    });

    await this.preferencesRepository.save(preferences);

    // Check if email OTP verification is enabled
    const otpEnabledRaw = await this.settingsService.getString('EMAIL_OTP_ENABLED', 'true');
    const otpEnabled = otpEnabledRaw.toLowerCase() === 'true';

    if (!otpEnabled) {
      // OTP disabled — auto-verify and log user in immediately
      savedUser.isEmailVerified = true;
      savedUser.isActive = true;
      savedUser.emailVerifiedAt = new Date();
      await this.userRepository.save(savedUser);

      const token = this.generateToken(savedUser);
      return {
        success: true,
        message: "Registration successful. Welcome to MedPark!",
        data: {
          userId: savedUser.id,
          name: savedUser.name,
          email: savedUser.email,
          role: savedUser.role,
          country: savedUser.country,
          phoneNumber: savedUser.phoneNumber,
          rating: savedUser.rating,
          ratingTier: savedUser.ratingTier,
          maxRating: savedUser.maxRating,
          subscriptionPlan: savedUser.subscriptionPlan,
          subscriptionExpiry: savedUser.subscriptionExpiry,
          resetCount: savedUser.resetCount,
          authProvider: savedUser.authProvider,
          hasLocalPassword: savedUser.hasLocalPassword,
          requiresVerification: false,
          token,
        },
      };
    }

    // OTP enabled — send verification email in background
    this.emailService.sendVerificationOtp(savedUser.email).catch(err => {
      console.error(`Failed to send initial verification email to ${savedUser.email}`, err);
    });

    return {
      success: true,
      message: "Registration successful. Please verify your email to activate your account.",
      data: {
        userId: savedUser.id,
        email: savedUser.email,
        requiresVerification: true
      },
    };
  }

  async sendVerification(email: string, isAutoTrigger = false) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || user.isEmailVerified) {
      // Return a generic success message to prevent user enumeration
      return { success: true, message: 'If the email is registered and not yet verified, a verification code has been sent.' };
    }

    // If OTP is disabled globally, don't attempt to send an email
    const otpEnabledRaw = await this.settingsService.getString('EMAIL_OTP_ENABLED', 'true');
    if (otpEnabledRaw.toLowerCase() !== 'true') {
      return { success: true, message: 'Verification bypassed due to system settings.' };
    }

    const result = await this.emailService.sendVerificationOtp(normalizedEmail, isAutoTrigger);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  }

  async verifyOtp(email: string, code: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Email is already verified");
    }

    // If admin deactivated the account before the user could verify, block activation
    if (!user.isActive && user.isEmailVerified) {
      throw new BadRequestException("Account has been deactivated. Please contact support.");
    }

    const otpEnabledRaw = await this.settingsService.getString('EMAIL_OTP_ENABLED', 'true');
    const isOtpEnabled = otpEnabledRaw.toLowerCase() === 'true';

    if (isOtpEnabled) {
      const isValid = await this.emailService.verifyOtp(normalizedEmail, code);
      if (!isValid) {
        throw new BadRequestException("Invalid or expired verification code");
      }
    }

    user.isEmailVerified = true;
    user.isActive = true; // Activate account on verification
    user.emailVerifiedAt = new Date();
    await this.userRepository.save(user);

    // Generate JWT token for automatic login
    const token = this.generateToken(user);

    return {
      success: true,
      message: "Email successfully verified. Welcome to MedPark!",
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        phoneNumber: user.phoneNumber,
        rating: user.rating,
        ratingTier: user.ratingTier,
        maxRating: user.maxRating,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        resetCount: user.resetCount,
        authProvider: user.authProvider,
        hasLocalPassword: user.hasLocalPassword,
        token,
      },
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();

    // Check if OTP is enabled — if not, tell the frontend to show "contact support"
    const otpEnabledRaw = await this.settingsService.getString('EMAIL_OTP_ENABLED', 'true');
    if (otpEnabledRaw.toLowerCase() !== 'true') {
      return {
        success: false,
        code: 'OTP_DISABLED',
        message: 'Password recovery via email is currently unavailable. Please contact support.',
      };
    }

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    // We return success even if user not found to prevent user enumeration
    if (!user) {
      return { success: true, message: "If the email is registered, a reset code has been sent." };
    }

    const result = await this.emailService.sendPasswordResetOtp(normalizedEmail);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return result;
  }

  async resetPassword(resetPasswordDto: import('./dto/reset-password.dto').ResetPasswordDto) {
    const { email, code, newPassword } = resetPasswordDto;
    const normalizedEmail = email.toLowerCase();

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      // Generic message to avoid disclosing account status
      throw new BadRequestException("Invalid or expired reset code");
    }

    const isValid = await this.emailService.verifyResetOtp(normalizedEmail, code);
    if (!isValid) {
      throw new BadRequestException("Invalid or expired reset code");
    }

    // Update password (will be hashed by @BeforeUpdate hook)
    user.password = newPassword;
    user.hasLocalPassword = true;
    user.lastLoginAt = new Date(); // Track this as a login event
    await this.userRepository.save(user);

    // Invalidate auth cache
    await this.invalidateUserAuthCache(user.id);

    // Generate JWT token for automatic login
    const token = this.generateToken(user);

    return {
      success: true,
      message: "Password has been reset successfully. Welcome back!",
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        phoneNumber: user.phoneNumber,
        rating: user.rating,
        ratingTier: user.ratingTier,
        maxRating: user.maxRating,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        resetCount: user.resetCount,
        authProvider: user.authProvider,
        hasLocalPassword: user.hasLocalPassword,
        token,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { password } = loginDto;
    const email = loginDto.email?.toLowerCase();

    // Find user with password field (case-insensitive check for older users)
    const user = await this.userRepository
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("LOWER(user.email) = :email", { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Validate password BEFORE checking account status to avoid user enumeration via error messages
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isEmailVerified) {
      // Automatically send a new OTP in the background if they try to log in.
      // The EmailService's internal 60-second cooldown prevents spam if they 
      // recently registered or requested one.
      this.sendVerification(email, true).catch(err => {
        // Just log the error, don't crash the login response
        console.error(`Auto-resend OTP failed for ${email}:`, err);
      });
      
      throw new UnauthorizedException("EMAIL_NOT_VERIFIED");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Update last login and streak
    this.applyLoginStreak(user);
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);
    await this.invalidateUserAuthCache(user.id);

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      success: true,
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        phoneNumber: user.phoneNumber,
        rating: user.rating,
        ratingTier: user.ratingTier,
        maxRating: user.maxRating,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        resetCount: user.resetCount,
        authProvider: user.authProvider,
        hasLocalPassword: user.hasLocalPassword,
        token,
      },
    };
  }

  private applyLoginStreak(user: User): void {
    const todayUTC = new Date().toISOString().slice(0, 10);
    const lastUTC = user.lastLoginAt
      ? new Date(user.lastLoginAt).toISOString().slice(0, 10)
      : null;

    if (!lastUTC || lastUTC === todayUTC) {
      // First ever login or already logged in today — start at 1 if no streak yet
      if (!lastUTC) user.loginStreak = 1;
      // else: same day, no change
    } else {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayUTC = yesterday.toISOString().slice(0, 10);

      if (lastUTC === yesterdayUTC) {
        user.loginStreak = (user.loginStreak || 0) + 1;
      } else {
        user.loginStreak = 1;
      }
    }

    if (user.loginStreak > (user.longestLoginStreak || 0)) {
      user.longestLoginStreak = user.loginStreak;
    }
  }

  // [Removed] loginWithGoogle / createOAuthCode / exchangeOAuthCode /
  // generatePlaceholderPhoneNumber were part of the Google OAuth flow that has
  // been retired from MedPark. The `googleId`, `authProvider`, and
  // `hasLocalPassword` columns on the User entity are intentionally retained
  // so existing Google-only accounts can still recover access via the
  // standard forgot-password / reset flow (UsersService.setPassword still
  // tolerates hasLocalPassword=false).

  async logout(userId: number, token?: string) {
    if (token) {
      const decoded: any = this.jwtService.decode(token);
      if (decoded && decoded.exp) {
        const ttlMs = (decoded.exp - Math.floor(Date.now() / 1000)) * 1000;
        if (ttlMs > 0) {
          await this.cacheManager.set(`blocklist:${token}`, 1, ttlMs);
        }
      }
    }
    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  async getCurrentUser(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      success: true,
      data: {
        userId: user.id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        phoneNumber: user.phoneNumber,
        rating: user.rating,
        ratingTier: user.ratingTier,
        maxRating: user.maxRating,
        contestsParticipated: user.contestsParticipated,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry,
        isProfilePublic: user.isProfilePublic,
        resetCount: user.resetCount,
        authProvider: user.authProvider,
        hasLocalPassword: user.hasLocalPassword,
        createdAt: user.createdAt,
      },
    };
  }

  private generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    return this.jwtService.sign(payload);
  }

  private async invalidateUserAuthCache(userId: number) {
    await this.cacheManager.del(authUserCacheKey(userId));
  }
}
