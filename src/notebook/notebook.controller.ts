import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotebookService } from './notebook.service';
import { CreateNotebookEntryDto, UpdateNotebookEntryDto } from './dto/notebook.dto';

@ApiTags('Notebook')
@Controller('notebook')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotebookController {
  constructor(private readonly notebookService: NotebookService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notebook entries' })
  async findAll(@Request() req) {
    return this.notebookService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notebook entry' })
  async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.notebookService.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new notebook entry' })
  async create(@Request() req, @Body() createDto: CreateNotebookEntryDto) {
    return this.notebookService.create(req.user.id, createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a notebook entry' })
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateNotebookEntryDto,
  ) {
    return this.notebookService.update(req.user.id, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notebook entry' })
  async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.notebookService.remove(req.user.id, id);
  }
}
