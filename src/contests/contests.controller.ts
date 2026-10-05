import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { ContestsService } from './contests.service';
import { AdminGateGuard } from '../admin/admin-gate.guard';
import {
  CreateContestDto,
  AddExistingQuestionDto,
  CreateContestQuestionDto,
} from './dto/contest.dto';

@ApiTags('Contests')
@Controller('contests')
@ApiBearerAuth()
export class ContestsController {
  constructor(private readonly contestsService: ContestsService) {}

  // PUBLIC/USER ENDPOINTS
  @Get('active')
  @ApiOperation({ summary: 'Get all active contests' })
  async getActiveContests() {
    return this.contestsService.getActiveContests();
  }

  @Get('past')
  @ApiOperation({ summary: 'Get all past completed contests' })
  async getPastContests() {
    return this.contestsService.getPastContests();
  }

  @Get('all/admin')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all contests for administration (Admin)' })
  async getAllContests() {
    return this.contestsService.getAllContests();
  }

  @Get('search-questions')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search questions in database (Admin)' })
  async searchQuestions(
    @Query('q') query: string,
    @Query('subjectId') subjectId?: number,
  ) {
    return this.contestsService.searchQuestions(query, subjectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contest details' })
  async getContest(@Param('id', ParseIntPipe) id: number) {
    return this.contestsService.getContest(id);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register for a contest' })
  async register(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.contestsService.register(req.user.id, id);
  }

  @Post(':id/unregister')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel registration for a contest' })
  async unregister(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.contestsService.unregister(req.user.id, id);
  }

  @Get(':id/participation')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user participation status' })
  async getStatus(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.contestsService.getParticipationStatus(req.user.id, id);
  }

  @Get(':id/standings')
  @ApiOperation({ summary: 'Get contest standings/leaderboard' })
  async getStandings(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.contestsService.getContestStandings(id, page || 1, limit || 50);
  }

  @Get(':id/questions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start/Resume contest and get questions' })
  async startContest(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.contestsService.getContestQuestions(id, req.user.id);
  }

  @Post(':id/submit-answer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit an answer for a contest question' })
  async submitAnswer(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { questionId: number; selectedOptionId: number; timeSpentSeconds?: number }
  ) {
    return this.contestsService.submitAnswer(req.user.id, id, body.questionId, body.selectedOptionId, body.timeSpentSeconds);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete/Submit the contest' })
  async completeContest(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.contestsService.completeContest(req.user.id, id);
  }

  @Get(':id/questions/admin')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all questions in a contest (Admin)' })
  async getAdminQuestions(@Param('id', ParseIntPipe) id: number) {
    return this.contestsService.getAdminContestQuestions(id);
  }

  @Post(':id/questions/:questionId/remove')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a question from a contest (Admin)' })
  async removeQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.contestsService.removeQuestion(id, questionId);
  }

  @Post(':id/calculate-results')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Calculate results for a completed contest (Admin)' })
  async calculateResults(@Param('id', ParseIntPipe) id: number) {
    return this.contestsService.calculateContestResults(id);
  }

  // ADMIN ENDPOINTS
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new contest (Admin)' })
  async createContest(@Body() createDto: CreateContestDto) {
    return this.contestsService.createContest(createDto);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an existing contest (Admin)' })
  async updateContest(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<CreateContestDto>,
  ) {
    return this.contestsService.updateContest(id, updateDto);
  }

  @Post(':id/questions/existing')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add existing question to contest (Admin)' })
  async addExistingQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() addDto: AddExistingQuestionDto,
  ) {
    return this.contestsService.addExistingQuestion(id, addDto);
  }

  @Post(':id/questions/new')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create and add new question to contest (Admin)' })
  async createAndAddQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() createDto: CreateContestQuestionDto,
  ) {
    return this.contestsService.createAndAddQuestion(id, createDto);
  }
}
