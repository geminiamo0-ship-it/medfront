import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { EncryptionInterceptor } from './encryption.interceptor';

@Module({
  providers: [EncryptionService, EncryptionInterceptor],
  // EncryptionInterceptor is wired via APP_INTERCEPTOR in AppModule and does
  // not need to be injected elsewhere — only EncryptionService is exported.
  exports: [EncryptionService],
})
export class EncryptionModule {}
