import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareersService } from './careers.service';
import { CareersController } from './careers.controller';
import { CareersAdminController } from './careers-admin.controller';
import { JobPosting } from '../entities/job-posting.entity';
import { JobApplication } from '../entities/job-application.entity';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosting, JobApplication]), AdminModule],
  controllers: [CareersController, CareersAdminController],
  providers: [CareersService],
  exports: [CareersService],
})
export class CareersModule {}
