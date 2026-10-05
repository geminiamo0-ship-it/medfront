import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { UserDailyStats } from '../entities/user-daily-stats.entity';
import { UserSpecialBadge } from '../entities/user-special-badge.entity';
import { SettingsService } from '../settings/settings.service';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { UserPreferences, Theme } from '../entities/user-preferences.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto as ProfileUpdateDto, UpdatePrivacySettingsDto, PublicProfileDto } from './dto/profile.dto';
import { QuestionSubmission } from '../entities/question-submission.entity';
import { QuestionInteraction } from '../entities/question-interaction.entity';
import { QuestionNote } from '../entities/question-note.entity';
import { QuestionFeedback } from '../entities/question-feedback.entity';
import { Test } from '../entities/test.entity';
import { TestQuestion } from '../entities/test-question.entity';
import { TestAnalyticsSnapshot } from '../entities/test-analytics-snapshot.entity';
import { UserAnalyticsStats } from '../entities/user-analytics-stats.entity';
import { UserDimensionStats } from '../entities/user-dimension-stats.entity';
import { AdminHistory } from '../entities/admin-history.entity';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { BlockedIp } from '../entities/blocked-ip.entity';
import { ALL_EXAM_STEPS } from '../entities/question-bank.entity';
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Inject } from "@nestjs/common";
import { authUserCacheKey, userSettingsCacheKey } from '../cache/cache-keys.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPreferences)
    private preferencesRepository: Repository<UserPreferences>,
    @InjectRepository(ContestParticipant)
    private participantRepository: Repository<ContestParticipant>,
    @InjectRepository(QuestionSubmission)
    private submissionRepository: Repository<QuestionSubmission>,
    @InjectRepository(QuestionInteraction)
    private interactionRepository: Repository<QuestionInteraction>,
    @InjectRepository(QuestionNote)
    private noteRepository: Repository<QuestionNote>,
    @InjectRepository(QuestionFeedback)
    private feedbackRepository: Repository<QuestionFeedback>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
    @InjectRepository(TestAnalyticsSnapshot)
    private testAnalyticsSnapshotRepository: Repository<TestAnalyticsSnapshot>,
    @InjectRepository(UserAnalyticsStats)
    private userAnalyticsStatsRepository: Repository<UserAnalyticsStats>,
    @InjectRepository(UserDimensionStats)
    private userDimensionStatsRepository: Repository<UserDimensionStats>,
    @InjectRepository(AdminHistory)
    private historyRepo: Repository<AdminHistory>,
    @InjectRepository(UserActivityLog)
    private activityLogRepository: Repository<UserActivityLog>,
    @InjectRepository(BlockedIp)
    private blockedIpRepository: Repository<BlockedIp>,
    @InjectRepository(UserDailyStats)
    private dailyStatsRepository: Repository<UserDailyStats>,
    @InjectRepository(UserSpecialBadge)
    private specialBadgeRepo: Repository<UserSpecialBadge>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private readonly settingsService: SettingsService,
  ) {}

  async findOne(id: number) {
    return this.userRepository.findOne({ where: { id } });
  }

  async findAll(
    limit: number = 50,
    offset: number = 0,
    search?: string,
    subscription?: string,
    activeOnly?: boolean,
    status?: 'active' | 'inactive',
  ) {
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (search) {
      queryBuilder.where('user.name ILIKE :search OR user.email ILIKE :search OR user.nickname ILIKE :search', { search: `%${search}%` });
    }

    if (subscription) {
      queryBuilder.andWhere('user.subscriptionPlan = :subscription', {
        subscription,
      });
    }

    if (activeOnly) {
      queryBuilder.andWhere('user.subscriptionExpiry IS NOT NULL');
      queryBuilder.andWhere('user.subscriptionExpiry > NOW()');
    }

    if (status === 'active') {
      queryBuilder.andWhere('user.isActive = true');
    } else if (status === 'inactive') {
      queryBuilder.andWhere('user.isActive = false');
    }

    const [users, total] = await queryBuilder.getManyAndCount();
    return {
      success: true,
      data: users,
      total,
    };
  }

  async updateRole(userId: number, role: UserRole) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.role = role;
    await this.userRepository.save(user);
    await this.invalidateUserAuthCache(userId);

    return {
      success: true,
      message: `User role updated to ${role}`,
    };
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check nickname uniqueness if changing nickname
    if (updateProfileDto.nickname && updateProfileDto.nickname !== user.nickname) {
      const existingNickname = await this.userRepository.findOne({
        where: { nickname: updateProfileDto.nickname },
      });
      if (existingNickname) {
        throw new BadRequestException('This nickname is already taken');
      }
      user.nickname = updateProfileDto.nickname;
    }

    // Update only provided fields
    if (updateProfileDto.name) {
      user.name = updateProfileDto.name;
    }

    if (updateProfileDto.country) {
      user.country = updateProfileDto.country;
    }

    if (updateProfileDto.dateOfBirth) {
      user.dateOfBirth = new Date(updateProfileDto.dateOfBirth);
    }

    if (updateProfileDto.phoneNumber !== undefined) {
      if (updateProfileDto.phoneNumber && updateProfileDto.phoneNumber !== user.phoneNumber) {
      const existingPhone = await this.userRepository.findOne({
        where: { phoneNumber: updateProfileDto.phoneNumber },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone number already registered');
      }
      user.phoneNumber = updateProfileDto.phoneNumber;
      }
    }

    if (updateProfileDto.telegramUsername !== undefined) {
      user.telegramUsername = updateProfileDto.telegramUsername;
    }

    const updatedUser = await this.userRepository.save(user);
    await this.invalidateUserCaches(userId);

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId: updatedUser.id,
        name: updatedUser.name,
        nickname: updatedUser.nickname,
        country: updatedUser.country,
        dateOfBirth: updatedUser.dateOfBirth,
        phoneNumber: updatedUser.phoneNumber,
        telegramUsername: updatedUser.telegramUsername,
      },
    };
  }

  async getPreferences(userId: number) {
    const cacheKey = userSettingsCacheKey(userId);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return { success: true, data: cached };

    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId,
        theme: Theme.DARK,
        emailNotifications: true,
        contestReminders: true,
        defaultStep: 1,
      });
      preferences = await this.preferencesRepository.save(preferences);
    }

    const responseData = {
      theme: preferences.theme,
      emailNotifications: preferences.emailNotifications,
      contestReminders: preferences.contestReminders,
      defaultStep: preferences.defaultStep,
      defaultQuestionBankId: preferences.defaultQuestionBankId,
    };

    await this.cacheManager.set(cacheKey, responseData, 3600000); // 1 hour

    return {
      success: true,
      data: responseData,
    };
  }

  async updatePreferences(
    userId: number,
    updatePreferencesDto: UpdatePreferencesDto,
  ) {
    let preferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    // Create preferences if they don't exist
    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId,
      });
    }

    // Update only provided fields
    if (updatePreferencesDto.theme !== undefined) {
      preferences.theme = updatePreferencesDto.theme;
    }

    if (updatePreferencesDto.emailNotifications !== undefined) {
      preferences.emailNotifications = updatePreferencesDto.emailNotifications;
    }

    if (updatePreferencesDto.contestReminders !== undefined) {
      preferences.contestReminders = updatePreferencesDto.contestReminders;
    }

    if (updatePreferencesDto.defaultStep !== undefined) {
      preferences.defaultStep = updatePreferencesDto.defaultStep;
    }

    if (updatePreferencesDto.defaultQuestionBankId !== undefined) {
      preferences.defaultQuestionBankId = updatePreferencesDto.defaultQuestionBankId;
    }

    const updatedPreferences = await this.preferencesRepository.save(preferences);

    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(userSettingsCacheKey(userId));

    return {
      success: true,
      message: 'Preferences updated successfully',
      data: {
        theme: updatedPreferences.theme,
        emailNotifications: updatedPreferences.emailNotifications,
        contestReminders: updatedPreferences.contestReminders,
        defaultStep: updatedPreferences.defaultStep,
        defaultQuestionBankId: updatedPreferences.defaultQuestionBankId,
      },
    };
  }
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user with password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Update password (will be hashed by @BeforeUpdate hook)
    user.password = newPassword;
    user.hasLocalPassword = true;
    await this.userRepository.save(user);
    await this.invalidateUserAuthCache(userId);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  async setPassword(userId: number, newPassword: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Legacy Google-OAuth-only users have hasLocalPassword=false; allow them
    // to set a password via this endpoint exactly once. Everyone with a local
    // password must go through change-password to rotate it.
    if (user.hasLocalPassword) {
      throw new BadRequestException('Password already set. Use change password instead.');
    }

    user.password = newPassword;
    user.hasLocalPassword = true;
    await this.userRepository.save(user);
    await this.invalidateUserAuthCache(userId);

    return {
      success: true,
      message: 'Password set successfully',
    };
  }

  // Profile System Methods
  async toggleUserStatus(
    userId: number,
    options?: { unblockLinkedIp?: boolean; adminEmail?: string | null },
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify the status of administrative accounts.');
    }

    const wasActive = user.isActive !== false;

    // Flip the status switch
    user.isActive = !user.isActive;
    await this.userRepository.save(user);

    await this.invalidateUserAuthCache(userId);

    let unblockedIp: string | null = null;
    let unblockedIpId: number | null = null;
    if (
      wasActive === false &&
      user.isActive === true &&
      options?.unblockLinkedIp &&
      options.adminEmail
    ) {
      const linkedBlock = await this.blockedIpRepository.findOne({
        where: {
          linkedUserId: user.id,
          sourceType: 'admin_user_deactivation',
          active: true,
        },
        order: { updatedAt: 'DESC' },
      });

      if (linkedBlock) {
        linkedBlock.active = false;
        linkedBlock.unblockedAt = new Date();
        linkedBlock.unblockedBy = options.adminEmail;
        await this.blockedIpRepository.save(linkedBlock);
        await this.cacheManager.del(this.blockedIpCacheKey(linkedBlock.ip));
        unblockedIp = linkedBlock.ip;
        unblockedIpId = linkedBlock.id;
      }
    }

    return {
      success: true,
      message: `User account has been ${user.isActive ? 'activated' : 'deactivated'}.`,
      data: {
        isActive: user.isActive,
        userName: user.name,
        userEmail: user.email,
        unblockedIp,
        unblockedIpId,
      },
    };
  }

  async deactivateAndBlockLatestIp(
    userId: number,
    adminEmail?: string | null,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify the status of administrative accounts.');
    }

    const latestIp = await this.getLatestKnownIp(user.id);
    if (!latestIp) {
      throw new BadRequestException('No recorded IP is available to ban for this user.');
    }

    if (user.isActive !== false) {
      user.isActive = false;
      await this.userRepository.save(user);
      await this.invalidateUserAuthCache(userId);
    }

    const existingBlock = await this.blockedIpRepository.findOne({
      where: { ip: latestIp },
    });

    const reason = 'Admin deactivated account and banned latest known IP';
    const metadata = {
      source: 'admin_user_management',
      action: 'deactivate_and_block_ip',
      targetUserId: user.id,
      targetUserEmail: user.email,
      targetUserName: user.name,
    };

    let blockedIp: BlockedIp;
    if (!existingBlock) {
      blockedIp = this.blockedIpRepository.create({
        ip: latestIp,
        active: true,
        reason,
        linkedUserId: user.id,
        sourceType: 'admin_user_deactivation',
        blockedBy: adminEmail || null,
        metadata,
      });
    } else {
      blockedIp = existingBlock;
      blockedIp.active = true;
      blockedIp.reason = reason;
      blockedIp.linkedUserId = user.id;
      blockedIp.sourceType = 'admin_user_deactivation';
      blockedIp.blockedBy = adminEmail || existingBlock.blockedBy || null;
      blockedIp.blockedAt = new Date();
      blockedIp.unblockedAt = null;
      blockedIp.unblockedBy = null;
      blockedIp.metadata = {
        ...(existingBlock.metadata || {}),
        ...metadata,
      };
    }

    const savedBlock = await this.blockedIpRepository.save(blockedIp);
    await this.cacheManager.del(this.blockedIpCacheKey(savedBlock.ip));

    return {
      success: true,
      message: 'User account has been deactivated and the latest known IP has been blocked.',
      data: {
        isActive: false,
        userName: user.name,
        userEmail: user.email,
        blockedIp: savedBlock.ip,
        blockedIpId: savedBlock.id,
        ipAlreadyBlocked: !!existingBlock,
      },
    };
  }

  async resetUserPassword(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot reset the password of administrative accounts.');
    }

    // Build a deeply random string mapping standard sets
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const nums = '0123456789';
    const spec = '!@#$%^&*()';
    const merged = upper + lower + nums + spec;

    let cleartext = '';
    for (let i = 0; i < 10; i++) {
        cleartext += merged.charAt(Math.floor(Math.random() * merged.length));
    }
    
    // Enforce strong rules guarantees to bypass any loose entity validators
    cleartext += upper.charAt(Math.floor(Math.random() * upper.length));
    cleartext += nums.charAt(Math.floor(Math.random() * nums.length));
    cleartext += spec.charAt(Math.floor(Math.random() * spec.length));

    // Scramble it to prevent predictability
    cleartext = cleartext.split('').sort(() => Math.random() - 0.5).join('');

    // Trigger TypeORM @BeforeUpdate encryption hook underneath
    user.password = cleartext;
    user.hasLocalPassword = true;
    await this.userRepository.save(user);

    // Record a password reset timestamp inside Redis to instantly invalidate any existing stateless JWTs
    const nowInSeconds = Math.floor(Date.now() / 1000);
    // JWT expiration is normally 7d (604800s). We keep this blocklist active for 8 days.
    await this.cacheManager.set(`pwd_reset:${userId}`, nowInSeconds, 691200 * 1000); 

    // Blast their cached user object 
    await this.invalidateUserAuthCache(userId);

    return {
      success: true,
      message: 'Administrative password reset executed.',
      data: {
        newPassword: cleartext,
        userName: user.name,
        userEmail: user.email
      },
    };
  }

  async getPublicProfile(userId: number, requestingUserId?: number): Promise<PublicProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if profile is public or if user is viewing their own profile
    const isOwnProfile = requestingUserId != null && Number(requestingUserId) === Number(userId);
    if (!user.isProfilePublic && !isOwnProfile) {
      throw new NotFoundException('This profile is private');
    }

    // Build public profile based on privacy settings
    const publicProfile: PublicProfileDto = {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      country: user.country,
      rating: user.rating,
      maxRating: user.maxRating,
      ratingTier: user.ratingTier,
      contestsParticipated: user.contestsParticipated,
      subscriptionPlan: user.subscriptionPlan,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      specialization: user.specialization,
      createdAt: user.createdAt,
    };

    // Add optional fields based on privacy settings or if viewing own profile
    if (user.showEmail || isOwnProfile) {
      publicProfile.email = user.email;
    }

    if (user.showInstitution || isOwnProfile) {
      publicProfile.institution = user.institution;
      publicProfile.graduationYear = user.graduationYear;
    }

    // Always show professional links if they exist
    if (user.linkedinUrl) publicProfile.linkedinUrl = user.linkedinUrl;
    if (user.githubUrl) publicProfile.githubUrl = user.githubUrl;
    if (user.portfolioUrl) publicProfile.portfolioUrl = user.portfolioUrl;

    return publicProfile;
  }

  async updateUserProfile(userId: number, updateDto: ProfileUpdateDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update profile fields
    Object.assign(user, updateDto);

    const updatedUser = await this.userRepository.save(user);
    await this.invalidateUserAuthCache(userId);

    return {
      success: true,
      message: 'Profile updated successfully',
      data: await this.getPublicProfile(userId, userId),
    };
  }

  async updatePrivacySettings(userId: number, updateDto: UpdatePrivacySettingsDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update privacy settings
    if (updateDto.isProfilePublic !== undefined) {
      user.isProfilePublic = updateDto.isProfilePublic;
    }
    if (updateDto.showEmail !== undefined) {
      user.showEmail = updateDto.showEmail;
    }
    if (updateDto.showInstitution !== undefined) {
      user.showInstitution = updateDto.showInstitution;
    }
    if (updateDto.showContestHistory !== undefined) {
      user.showContestHistory = updateDto.showContestHistory;
    }

    await this.userRepository.save(user);
    await this.invalidateUserAuthCache(userId);

    return {
      success: true,
      message: 'Privacy settings updated successfully',
      data: {
        isProfilePublic: user.isProfilePublic,
        showEmail: user.showEmail,
        showInstitution: user.showInstitution,
        showContestHistory: user.showContestHistory,
      },
    };
  }

  async getUserStats(userId: number, requestingUserId?: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check privacy
    const isOwnProfile = requestingUserId != null && Number(requestingUserId) === Number(userId);
    if (!user.isProfilePublic && !isOwnProfile) {
      throw new NotFoundException('This profile is private');
    }

    // Calculate actual stats
    const contestsJoined = await this.participantRepository.count({
      where: { userId },
    });

    const totalSolved = await this.submissionRepository.count({
      where: { userId, isCorrect: true },
    });

    return {
      success: true,
      data: {
        rating: user.rating,
        maxRating: user.maxRating,
        ratingTier: user.ratingTier,
        contestsParticipated: contestsJoined,
        totalSolved: totalSolved,
      },
    };
  }

  async getLeaderboard(limit: number = 100, offset: number = 0, search?: string) {
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .select([
        'user.id', 'user.name', 'user.nickname', 'user.country', 
        'user.rating', 'user.maxRating', 'user.ratingTier', 'user.contestsParticipated'
      ])
      .orderBy('user.rating', 'DESC')
      .take(limit)
      .skip(offset);

    if (search) {
      queryBuilder.where('user.name LIKE :search OR user.nickname LIKE :search', { search: `%${search}%` });
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    // For each user, get their last rating change
    const userIds = users.map(u => u.id);
    const lastParticipations = await this.participantRepository
      .createQueryBuilder('p')
      .where('p.userId IN (:...userIds)', { userIds })
      .orderBy('p.completedAt', 'DESC')
      .getMany();

    // Map last rating change from current rating - previous rating simulation
    // Since we don't store rating change directly in User, we look at the last contest result
    // In our seed, we don't store ratingChange in ContestParticipant? Let me check.
    // Wait, I did add it in the seed but it wasn't in the entity.
    
    return {
      success: true,
      data: users.map((u, index) => {
        const lastP = lastParticipations.find(p => p.userId === u.id);
        return {
          rank: offset + index + 1,
          userId: u.id.toString(),
          username: u.nickname || u.name,
          country: u.country,
          rating: u.rating,
          maxRating: u.maxRating,
          contestsParticipated: u.contestsParticipated,
          lastContestChange: lastP ? (lastP.ratingChange || 0) : 0,
          ratingTier: u.ratingTier,
        };
      }),
      total,
    };
  }

  async getContestHistory(userId: number, requestingUserId?: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check privacy
    const isOwnProfile = requestingUserId != null && Number(requestingUserId) === Number(userId);
    if (!user.isProfilePublic && !isOwnProfile) {
      throw new NotFoundException('This profile is private');
    }

    const participations = await this.participantRepository.find({
      where: { userId },
      relations: ['contest'],
      order: { completedAt: 'DESC' },
    });

    return {
      success: true,
      data: participations.map(p => ({
        id: p.id,
        contestId: p.contestId,
        contestTitle: p.contest.title,
        status: p.status,
        rank: p.rank,
        score: p.totalScore,
        accuracy: p.accuracyPercentage,
        completedAt: p.completedAt,
        ratingChange: p.ratingChange,
        oldRating: p.oldRating,
        newRating: (p.oldRating || 0) + (p.ratingChange || 0),
      })),
    };
  }

  async resetAllProgress(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.resetCount >= 2) {
      throw new BadRequestException('You have reached the maximum limit of 2 progress resets.');
    }

    const deletionSummary = {
      questionSubmissions: 0,
      questionInteractions: 0,
      questionNotes: 0,
      questionFeedback: 0,
      testQuestions: 0,
      testAnalyticsSnapshots: 0,
      userAnalyticsStats: 0,
      userDimensionStats: 0,
      tests: 0,
    };

    deletionSummary.questionSubmissions = await this.deleteQuestionSubmissions(userId);
    deletionSummary.questionInteractions = await this.deleteQuestionInteractions(userId);
    deletionSummary.questionNotes = await this.deleteQuestionNotes(userId);
    deletionSummary.questionFeedback = await this.deleteQuestionFeedback(userId);
    
    const userTests = await this.testRepository.find({ where: { userId }, select: ['id'] });
    const userTestIds = userTests.map(t => t.id);
    
    if (userTestIds.length > 0) {
      const tqResult = await this.testQuestionRepository.delete({
        testId: In(userTestIds)
      });
      deletionSummary.testQuestions = tqResult.affected || 0;

      const snapshotResult = await this.testAnalyticsSnapshotRepository.delete({
        testId: In(userTestIds),
      });
      deletionSummary.testAnalyticsSnapshots = snapshotResult.affected || 0;
    }

    const userAnalyticsStatsResult = await this.userAnalyticsStatsRepository.delete({ userId });
    deletionSummary.userAnalyticsStats = userAnalyticsStatsResult.affected || 0;

    const userDimensionStatsResult = await this.userDimensionStatsRepository.delete({ userId });
    deletionSummary.userDimensionStats = userDimensionStatsResult.affected || 0;
    
    deletionSummary.tests = await this.deleteTests(userId);

    try {
      const steps = ALL_EXAM_STEPS;
      const cachePromises = [
        this.cacheManager.del(`user_settings:${userId}`),
        this.cacheManager.del(`user_performance:${userId}:analytics:step:all`),
        ...steps.map(step => this.cacheManager.del(`user_performance:${userId}:analytics:step:${step}`)),
        ...userTestIds.map(testId => this.cacheManager.del(`test_performance:advanced:${testId}`)),
      ];
      steps.forEach(step => {
        cachePromises.push(this.cacheManager.del(`user_performance:${userId}:question_counts:step:${step}:filters:none`));
      });
      await Promise.all(cachePromises);
    } catch (cacheError) {
      console.error('[UsersService] Cache clear error:', cacheError);
    }

    user.resetCount = Number(user.resetCount || 0) + 1;
    await this.userRepository.save(user);

    try {
      const historyEntry = this.historyRepo.create({
        adminEmail: user.email,
        action: 'RESET_PROGRESS',
        topic: 'Delete Hub',
        targetEntity: 'User Progress',
        targetId: userId.toString(),
        details: {
          testIdsDeleted: userTestIds,
          deletedRecords: deletionSummary,
          resetCountAfter: user.resetCount,
        },
      });
      await this.historyRepo.save(historyEntry);
    } catch (e) {
      console.error('[UsersService] Error logging to AdminHistory:', e);
    }

    return {
      success: true,
      message: 'All progress data has been reset successfully',
      deletedRecords: deletionSummary,
      remainingResets: 2 - user.resetCount,
    };
  }

  private async deleteQuestionSubmissions(userId: number): Promise<number> {
    const result = await this.submissionRepository.delete({ userId, contestId: IsNull() });
    return result.affected || 0;
  }

  private async deleteQuestionInteractions(userId: number): Promise<number> {
    const result = await this.interactionRepository.delete({ userId, contestId: IsNull() });
    return result.affected || 0;
  }

  private async deleteQuestionNotes(userId: number): Promise<number> {
    const result = await this.noteRepository.delete({ userId });
    return result.affected || 0;
  }

  private async deleteQuestionFeedback(userId: number): Promise<number> {
    const result = await this.feedbackRepository.delete({ userId });
    return result.affected || 0;
  }

  private async deleteTests(userId: number): Promise<number> {
    const result = await this.testRepository.delete({ userId });
    return result.affected || 0;
  }

  private async getLatestKnownIp(userId: number) {
    const latestActivity = await this.activityLogRepository
      .createQueryBuilder('activity')
      .select(['activity.ipAddress'])
      .where('activity.userId = :userId', { userId })
      .andWhere('activity.ipAddress IS NOT NULL')
      .andWhere("activity.ipAddress <> ''")
      .orderBy('activity.createdAt', 'DESC')
      .limit(1)
      .getOne();
    const ip = latestActivity?.ipAddress?.trim();
    return ip ? ip : null;
  }

  private blockedIpCacheKey(ip: string) {
    return `security:blocked-ip:${ip}`;
  }

  private async invalidateUserAuthCache(userId: number) {
    await this.cacheManager.del(authUserCacheKey(userId));
  }

  private async invalidateUserCaches(userId: number) {
    await Promise.all([
      this.cacheManager.del(authUserCacheKey(userId)),
      this.cacheManager.del(userSettingsCacheKey(userId)),
    ]);
  }

  private applyLoginStreak(user: User): boolean {
    const todayUTC = new Date().toISOString().slice(0, 10);
    const lastUTC = user.lastLoginAt
      ? new Date(user.lastLoginAt).toISOString().slice(0, 10)
      : null;

    if (lastUTC === todayUTC) return false; // already counted today

    if (!lastUTC) {
      user.loginStreak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayUTC = yesterday.toISOString().slice(0, 10);
      user.loginStreak = lastUTC === yesterdayUTC ? (user.loginStreak || 0) + 1 : 1;
    }

    if (user.loginStreak > (user.longestLoginStreak || 0)) {
      user.longestLoginStreak = user.loginStreak;
    }
    user.lastLoginAt = new Date();
    return true;
  }

  async checkIn(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'lastLoginAt', 'loginStreak', 'longestLoginStreak'],
    });
    if (!user) return;
    if (this.applyLoginStreak(user)) {
      await this.userRepository.save(user);
    }
  }

  async getHomeStats(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'loginStreak', 'longestLoginStreak', 'questionStreak',
               'longestQuestionStreak', 'lastQuestionDate', 'contestsParticipated', 'rating'],
    });

    if (!user) throw new NotFoundException('User not found');

    const todayUTC = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoUTC = yearAgo.toISOString().slice(0, 10);

    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - 6);
    const weekStartUTC = weekStart.toISOString().slice(0, 10);
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const db = this.userRepository.manager;

    const [
      dailyRows,
      totalRow,
      [suspendedTest],
      recentTests,
      [upcomingContest],
      monthlyRows,
      rankRows,
      specialBadges,
      bronzeMax,
      silverMax,
      goldMax,
    ] = await Promise.all([
      // Calendar data (last year)
      this.dailyStatsRepository
        .createQueryBuilder('ds')
        .select(['ds.date', 'ds.questionsAttempted'])
        .where('ds.userId = :userId', { userId })
        .andWhere('ds.date >= :from', { from: yearAgoUTC })
        .orderBy('ds.date', 'ASC')
        .getMany(),

      // All-time total beyond calendar window
      this.dailyStatsRepository
        .createQueryBuilder('ds')
        .select('SUM(ds.questionsAttempted)', 'total')
        .where('ds.userId = :userId', { userId })
        .andWhere('ds.date < :from', { from: yearAgoUTC })
        .getRawOne(),

      // Last suspended test
      db.query<any[]>(
        `SELECT id, title, type, step,
                "totalQuestions", "answeredQuestions", "percentageScore", "updatedAt"
         FROM tests
         WHERE "userId" = $1 AND status = 'suspended'
         ORDER BY "updatedAt" DESC LIMIT 1`,
        [userId],
      ),

      // Last 3 completed tests
      db.query<any[]>(
        `SELECT id, title, type, step,
                "totalQuestions", "correctAnswers", "percentageScore", "completedAt"
         FROM tests
         WHERE "userId" = $1 AND status = 'completed'
         ORDER BY "completedAt" DESC LIMIT 3`,
        [userId],
      ),

      // Next live or open contest
      db.query<any[]>(
        `SELECT id, title, status, "startTime", "endTime",
                "durationMinutes", "totalQuestions", type
         FROM contests
         WHERE status IN ('registration_open', 'in_progress') AND "endTime" > NOW()
         ORDER BY CASE status WHEN 'in_progress' THEN 0 ELSE 1 END, "startTime" ASC
         LIMIT 1`,
        [],
      ),

      // Monthly totals — last 13 months (raw SQL, group by month)
      db.query<any[]>(
        `SELECT TO_CHAR(date, 'YYYY-MM') AS month,
                SUM(questions_attempted)::int AS total
         FROM user_daily_stats
         WHERE user_id = $1 AND date >= NOW() - INTERVAL '13 months'
         GROUP BY TO_CHAR(date, 'YYYY-MM')
         ORDER BY month ASC`,
        [userId],
      ),

      // Leaderboard rank (only if user has participated in contests)
      user.contestsParticipated > 0
        ? db.query<any[]>(
            `SELECT COUNT(*)::int AS count FROM users
             WHERE rating > $1 AND "isActive" = true`,
            [user.rating],
          )
        : Promise.resolve([{ count: null }]),

      // Special badges awarded by admins
      this.specialBadgeRepo.find({
        where: { userId },
        order: { awardedAt: 'DESC' },
      }),

      // Dynamic badge thresholds from settings
      this.settingsService.getNumber('BADGE_THRESHOLD_BRONZE', 49),
      this.settingsService.getNumber('BADGE_THRESHOLD_SILVER', 149),
      this.settingsService.getNumber('BADGE_THRESHOLD_GOLD',   299),
    ]);

    // --- Summaries ---
    let totalAllTime = Number(totalRow?.total || 0);
    let thisWeek = 0;
    let thisMonth = 0;
    for (const row of dailyRows) {
      totalAllTime += row.questionsAttempted;
      if (row.date >= weekStartUTC) thisWeek += row.questionsAttempted;
      if (row.date >= monthStart) thisMonth += row.questionsAttempted;
    }

    // --- Monthly badges (last 12 months) ---
    const getBadgeLevel = (total: number) => {
      if (total === 0) return 0;
      if (total <= bronzeMax) return 1;  // bronze
      if (total <= silverMax) return 2;  // silver
      if (total <= goldMax)   return 3;  // gold
      return 4;                           // platinum
    };

    const monthlyBadges: { month: string; total: number; level: number }[] = [];
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();
    for (let i = 11; i >= 0; i--) {
      let m = curMonth - i;
      let y = curYear;
      if (m < 0) { m += 12; y -= 1; }
      const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
      const row = monthlyRows.find((r: any) => r.month === monthStr);
      const total = row ? Number(row.total) : 0;
      monthlyBadges.push({ month: monthStr, total, level: getBadgeLevel(total) });
    }

    // --- Leaderboard rank ---
    const leaderboardRank =
      rankRows[0]?.count !== null ? Number(rankRows[0].count) + 1 : null;

    return {
      user: { name: user.name },
      loginStreak: { current: user.loginStreak || 0, longest: user.longestLoginStreak || 0 },
      questionStreak: {
        current: user.questionStreak || 0,
        longest: user.longestQuestionStreak || 0,
        solvedToday: user.lastQuestionDate === todayUTC,
      },
      calendar: dailyRows.map((r) => ({ date: r.date, count: r.questionsAttempted })),
      summary: { totalAllTime, thisWeek, thisMonth },
      lastSuspendedTest: suspendedTest ?? null,
      recentTests: recentTests ?? [],
      upcomingContest: upcomingContest ?? null,
      leaderboardRank,
      monthlyBadges,
      badgeThresholds: { bronze: bronzeMax, silver: silverMax, gold: goldMax },
      specialBadges: (specialBadges ?? []).map((b) => ({
        id: b.id,
        key: b.badgeType?.key ?? '',          // slug used to select the SVG icon on the client
        label: b.badgeType?.label ?? '',
        description: b.badgeType?.description ?? '',
        icon: b.badgeType?.icon ?? '🏅',
        color: b.badgeType?.color ?? '#6366f1',
        // awardedBy is intentionally omitted — admin identity must not be exposed to users
        note: b.note,
        awardedAt: b.awardedAt,
      })),
    };
  }
}
