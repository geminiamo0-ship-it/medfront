import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CareersService } from './careers.service';
import { CreateJobPostingDto, UpdateJobPostingDto, UpdateJobApplicationStatusDto } from './dto/careers.dto';
import { AdminHistoryService } from '../admin/admin-history.service';
import { AdminGateGuard } from '../admin/admin-gate.guard';

@ApiTags('Admin - Careers')
@ApiBearerAuth()
@Controller('admin/careers')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class CareersAdminController {
  constructor(
    private readonly careersService: CareersService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Get('jobs')
  @ApiOperation({ summary: 'List jobs (admin)' })
  async listJobs(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.careersService.getAdminJobs({ status, search });
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create job (admin)' })
  async createJob(@Body() body: CreateJobPostingDto, @Request() req) {
    const job = await this.careersService.createJob(body);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'CREATE_JOB_POSTING',
      'JobPosting',
      job.id.toString(),
      { title: job.title, status: job.status },
      'Careers',
    );
    return job;
  }

  @Patch('jobs/:id')
  @ApiOperation({ summary: 'Update job (admin)' })
  async updateJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateJobPostingDto,
    @Request() req,
  ) {
    const job = await this.careersService.updateJob(id, body);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_JOB_POSTING',
      'JobPosting',
      id.toString(),
      body,
      'Careers',
    );
    return job;
  }

  @Get('applications')
  @ApiOperation({ summary: 'List job applications (admin)' })
  async listApplications(
    @Query('jobId') jobId?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.careersService.getApplications({
      jobId: jobId ? Number(jobId) : undefined,
      status,
      search,
    });
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get application detail (admin)' })
  async getApplication(@Param('id', ParseIntPipe) id: number) {
    return this.careersService.getApplication(id);
  }

  @Patch('applications/:id/status')
  @ApiOperation({ summary: 'Update application status (admin)' })
  async updateApplicationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateJobApplicationStatusDto,
    @Request() req,
  ) {
    const application = await this.careersService.updateApplicationStatus(id, body.status);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_JOB_APPLICATION_STATUS',
      'JobApplication',
      id.toString(),
      { status: body.status },
      'Careers',
    );
    return application;
  }
}
