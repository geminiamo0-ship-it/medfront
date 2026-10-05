import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMessages1740000023000 implements MigrationInterface {
  name = 'CreateMessages1740000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"         SERIAL PRIMARY KEY,
        "senderId"   INT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "receiverId" INT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "content"    TEXT       NOT NULL,
        "isRead"     BOOLEAN    NOT NULL DEFAULT false,
        "createdAt"  TIMESTAMP  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_messages_createdAt" ON "messages" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
  }
}
