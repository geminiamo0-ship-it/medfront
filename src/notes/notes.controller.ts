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
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotesService } from "./notes.service";
import { CreateNoteDto, UpdateNoteDto } from "./dto/notes.dto";

@ApiTags("Notes")
@Controller("notes")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: "Get all user notes with optional search" })
  async findAll(@Request() req, @Query("search") search?: string) {
    return this.notesService.findAll(req.user.id, search);
  }

  @Get("question/:questionId")
  @ApiOperation({ summary: "Get note for a specific question" })
  async findByQuestionId(
    @Request() req,
    @Param("questionId", ParseIntPipe) questionId: number,
  ) {
    return this.notesService.findByQuestionId(req.user.id, questionId);
  }

  @Get("question/:questionId/preview")
  @ApiOperation({
    summary:
      "Get the linked question preview for a noted question (read-only; requires an existing note)",
  })
  async getQuestionPreview(
    @Request() req,
    @Param("questionId", ParseIntPipe) questionId: number,
  ) {
    return this.notesService.getQuestionPreview(req.user.id, questionId);
  }

  @Post()
  @ApiOperation({ summary: "Create or update a note for a question" })
  async create(@Request() req, @Body() createDto: CreateNoteDto) {
    return this.notesService.create(req.user.id, createDto);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a specific note" })
  async update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateDto: UpdateNoteDto,
  ) {
    return this.notesService.update(req.user.id, id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a specific note" })
  async remove(@Request() req, @Param("id") id: string) {
    return this.notesService.remove(req.user.id, id);
  }
}
