import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTickets1740000026000 implements MigrationInterface {
  name = 'CreateSupportTickets1740000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id"           BIGSERIAL PRIMARY KEY,
        "ticketSeqId"  VARCHAR(255)  NOT NULL UNIQUE,
        "userId"       INT           NOT NULL REFERENCES "users"("id"),
        "subject"      VARCHAR(255)  NOT NULL,
        "category"     VARCHAR(255)  NOT NULL,
        "priority"     VARCHAR(255)  NOT NULL,
        "status"       VARCHAR(255)  NOT NULL DEFAULT 'new',
        "createdAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP     NOT NULL DEFAULT now(),
        "resolvedAt"   TIMESTAMP,
        "resolvedBy"   INT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
  }
}
