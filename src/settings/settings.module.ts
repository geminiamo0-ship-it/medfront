import { Module } from '@nestjs/common';
import { PublicSettingsController } from './public-settings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../entities/app-setting.entity';
import { SettingsService } from './settings.service';
import { Partner } from '../entities/partner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, Partner])],
  controllers: [PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
