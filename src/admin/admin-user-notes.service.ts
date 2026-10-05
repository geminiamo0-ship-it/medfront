import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminUserNote } from "../entities/admin-user-note.entity";

@Injectable()
export class AdminUserNotesService {
  constructor(
    @InjectRepository(AdminUserNote)
    private notesRepository: Repository<AdminUserNote>,
  ) {}

  async getNotes(userId: number, limit = 10, offset = 0) {
    const [notes, total] = await this.notesRepository.findAndCount({
      where: { userId },
      relations: ["admin"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    return {
      success: true,
      total,
      limit,
      offset,
      data: notes.map((note) => ({
        id: note.id,
        userId: note.userId,
        adminId: note.adminId,
        adminEmail: note.admin?.email || null,
        note: note.note,
        createdAt: note.createdAt,
      })),
    };
  }

  async createNote(userId: number, adminId: number | null, note: string) {
    const trimmed = (note || "").trim();
    if (!trimmed) {
      throw new BadRequestException("Note content is required");
    }

    const created = this.notesRepository.create({
      userId,
      adminId,
      note: trimmed,
    });
    const saved = await this.notesRepository.save(created);

    return {
      success: true,
      data: {
        id: saved.id,
        userId: saved.userId,
        adminId: saved.adminId,
        note: saved.note,
        createdAt: saved.createdAt,
      },
    };
  }

  async deleteNote(noteId: number) {
    await this.notesRepository.delete({ id: noteId });
    return { success: true };
  }
}
