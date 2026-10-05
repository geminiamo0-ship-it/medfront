import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotebookEntry } from '../entities/notebook-entry.entity';
import { NotebookService } from './notebook.service';
import { NotebookController } from './notebook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotebookEntry])],
  controllers: [NotebookController],
  providers: [NotebookService],
})
export class NotebookModule {}
