import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateAdminExpenses1781000008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "admin_expenses",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "category",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "amount",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: "note",
            type: "text",
            isNullable: true,
          },
          {
            name: "incurred_at",
            type: "timestamp",
            isNullable: false,
            default: "NOW()",
          },
          {
            name: "created_by",
            type: "int",
            isNullable: true,
          },
          {
            name: "updated_by",
            type: "int",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "NOW()",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "NOW()",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("admin_expenses");
  }
}
