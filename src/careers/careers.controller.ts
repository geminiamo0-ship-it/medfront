import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CareersService } from "./careers.service";
import { CreateJobApplicationDto } from "./dto/careers.dto";
import { JOB_APPLICATION_THROTTLE } from "../rate-limit/rate-limit.constants";

@ApiTags("Careers")
@Controller("careers")
export class CareersController {
  constructor(private readonly careersService: CareersService) {}

  @Get("jobs")
  @ApiOperation({ summary: "List open jobs" })
  async listOpenJobs() {
    return this.careersService.getOpenJobs();
  }

  @Get("jobs/:id")
  @ApiOperation({ summary: "Get job details (open only)" })
  async getJob(@Param("id", ParseIntPipe) id: number) {
    return this.careersService.getPublicJob(id);
  }

  @Post("jobs/:id/apply")
  @Throttle(JOB_APPLICATION_THROTTLE)
  @ApiOperation({ summary: "Apply to a job (public)" })
  async applyToJob(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateJobApplicationDto,
  ) {
    return this.careersService.createApplication(id, body);
  }
}
