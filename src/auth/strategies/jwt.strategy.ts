import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { authUserCacheKey } from '../../cache/cache-keys.util';

export interface JwtPayload {
  sub: number;
  email: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly USER_DATE_FIELDS: Array<keyof User> = [
    'dateOfBirth',
    'subscriptionExpiry',
    'subscriptionStartDate',
    'trialStartDate',
    'trialEndDate',
    'lastLoginAt',
    'createdAt',
    'updatedAt',
  ];

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER') || 'medpark.io',
      audience: configService.get<string>('JWT_AUDIENCE') || 'api.medpark.io',
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload): Promise<User> {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request as any);
    if (rawToken) {
      const isBlocklisted = await this.cacheManager.get(`blocklist:${rawToken}`);
      if (isBlocklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const userId = payload.sub;

    // Check if a password reset occurred recently forcing revocation of any tokens issued prior
    if (payload.iat) {
      const pwdResetTime = await this.cacheManager.get<number>(`pwd_reset:${userId}`);
      if (pwdResetTime && payload.iat < pwdResetTime) {
        throw new UnauthorizedException('Session terminated due to administrative password reset');
      }
    }

    const cacheKey = authUserCacheKey(userId);

    // 🚀 CACHE CHECK: Check Redis for authenticated user
    const cachedUser = await this.cacheManager.get<User>(cacheKey);
    if (cachedUser) {
      const hydratedUser = this.hydrateCachedUser(cachedUser);

      if (!hydratedUser.isActive || !hydratedUser.isEmailVerified) {
        throw new UnauthorizedException('Account is deactivated');
      }
      return hydratedUser;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true, isEmailVerified: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid token or user not found');
    }

    // 🚀 CACHE STORAGE: Cache user for 5 minutes (300s)
    await this.cacheManager.set(cacheKey, user, 300000);

    return user;
  }

  private hydrateCachedUser(cachedUser: User): User {
    const hydratedUser = { ...cachedUser } as User;
    const mutableUser = hydratedUser as unknown as Record<string, unknown>;

    for (const field of JwtStrategy.USER_DATE_FIELDS) {
      const value = mutableUser[field as string];

      if (!value || value instanceof Date) {
        continue;
      }

      mutableUser[field as string] = new Date(String(value));
    }

    return hydratedUser;
  }
}
