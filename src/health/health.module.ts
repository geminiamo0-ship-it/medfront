import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { DatabaseMonitorService } from './database-monitor.service';
import { TelegramService } from '../integrations/telegram.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [HealthService, DatabaseMonitorService, TelegramService],
  controllers: [HealthController],
  exports: [HealthService, DatabaseMonitorService],
})
export class HealthModule {}
