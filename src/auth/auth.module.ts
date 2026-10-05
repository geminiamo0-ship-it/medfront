import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../entities/user.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { TestsModule } from '../tests/tests.module';
import { SettingsModule } from '../settings/settings.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPreferences]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRATION');
        const isProd = configService.get<string>('NODE_ENV') === 'production';
        
        if (isProd && !expiresIn) {
          throw new Error('CRITICAL: JWT_EXPIRATION environment variable is missing.');
        }

        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn || '7d',
            issuer: configService.get<string>('JWT_ISSUER') || 'medpark.io',
            audience: configService.get<string>('JWT_AUDIENCE') || 'api.medpark.io',
          },
        };
      },
      inject: [ConfigService],
    }),
    AffiliateModule,
    TestsModule,
    SettingsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
