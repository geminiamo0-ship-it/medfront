import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateQuestionGroupings1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'question_groupings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'externalId',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'questionBankId',
            type: 'int',
          },
          {
            name: 'groupKey',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'position',
            type: 'int',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'question_groupings',
      new TableForeignKey({
        columnNames: ['questionBankId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'question_banks',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'question_groupings',
      new TableIndex({
        name: 'IDX_question_groupings_externalId_bankId',
        columnNames: ['externalId', 'questionBankId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'question_groupings',
      new TableIndex({
        name: 'IDX_question_groupings_bank_groupKey',
        columnNames: ['questionBankId', 'groupKey'],
      }),
    );

    // parentSetId is used as a cache / lookup accelerator
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_questions_parentSetId" ON "questions" ("parentSetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_questions_parentSetId"`,
    );
    await queryRunner.dropTable('question_groupings');
  }
}

