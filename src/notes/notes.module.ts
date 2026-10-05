import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotesService } from "./notes.service";
import { NotesController } from "./notes.controller";
import { QuestionNote } from "../entities/question-note.entity";
import { Question } from "../entities/question.entity";

@Module({
  imports: [TypeOrmModule.forFeature([QuestionNote, Question])],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
