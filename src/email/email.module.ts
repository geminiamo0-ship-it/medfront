import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { SettingsModule } from '../settings/settings.module';
import { SecurityModule } from '../security/security.module';

@Global()
@Module({
  imports: [SettingsModule, SecurityModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
