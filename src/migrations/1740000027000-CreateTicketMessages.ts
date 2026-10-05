import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketMessages1740000027000 implements MigrationInterface {
  name = 'CreateTicketMessages1740000027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ticket_messages" (
        "id"            BIGSERIAL PRIMARY KEY,
        "ticketId"      BIGINT        NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
        "senderId"      INT           NOT NULL REFERENCES "users"("id"),
        "content"       TEXT          NOT NULL,
        "attachmentUrl" VARCHAR(255),
        "createdAt"     TIMESTAMP     NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_messages"`);
  }
}
