import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateRequestRateLimitAlerts1781000009000 implements MigrationInterface {
  name = "CreateRequestRateLimitAlerts1781000009000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "request_rate_limit_alerts",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "user_id",
            type: "int",
            isNullable: true,
          },
          {
            name: "ip",
            type: "varchar",
            length: "64",
          },
          {
            name: "path",
            type: "varchar",
            length: "255",
          },
          {
            name: "method",
            type: "varchar",
            length: "12",
          },
          {
            name: "user_agent",
            type: "text",
            isNullable: true,
          },
          {
            name: "limit",
            type: "int",
          },
          {
            name: "total_hits",
            type: "int",
          },
          {
            name: "ttl_seconds",
            type: "int",
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "now()",
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      "request_rate_limit_alerts",
      new TableIndex({
        name: "idx_rate_limit_alerts_user_created",
        columnNames: ["user_id", "created_at"],
      }),
    );

    await queryRunner.createIndex(
      "request_rate_limit_alerts",
      new TableIndex({
        name: "idx_rate_limit_alerts_ip_created",
        columnNames: ["ip", "created_at"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      "request_rate_limit_alerts",
      "idx_rate_limit_alerts_user_created",
    );
    await queryRunner.dropIndex(
      "request_rate_limit_alerts",
      "idx_rate_limit_alerts_ip_created",
    );
    await queryRunner.dropTable("request_rate_limit_alerts");
  }
}
