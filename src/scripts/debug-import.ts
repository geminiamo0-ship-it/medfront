/**
 * Debug a single bank import and show errors
 * Usage: node --require ts-node/register ... src/scripts/debug-import.ts <db-path> <step> <bank-code>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';
import { Question } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { resolveQuestionExternalId } from './sqlite-import.utils';

const [,, dbPath, stepArg, bankCode] = process.argv;
if (!dbPath || !stepArg || !bankCode) {
  console.error('Usage: debug-import.ts <db-path> <step> <bank-code>');
  process.exit(1);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ds = app.get(DataSource);

  // Find the question bank
  const qb = await ds.getRepository(QuestionBank).findOne({ where: { code: bankCode } });
  if (!qb) { console.error(`❌ QuestionBank not found: ${bankCode}`); await app.close(); return; }
  console.log(`✅ Found QuestionBank: ${qb.name} (id=${qb.id})`);

  const db = new sqlite3.Database(path.resolve(dbPath));
  const all = promisify(db.all.bind(db));

  const questions = await all('SELECT * FROM questions ORDER BY id') as any[];
  console.log(`📄 ${questions.length} questions in SQLite`);

  const qRepo = ds.getRepository(Question);
  const oRepo = ds.getRepository(QuestionOption);

  let errors = 0;
  for (const q of questions) {
    try {
      const opts = await all(`SELECT * FROM options WHERE question_id = ${q.id}`) as any[];
      const existing = await qRepo.findOne({
        where: { externalId: resolveQuestionExternalId(q), questionBankId: qb.id },
      });
      if (existing) { console.log(`  ⏭️  Q${q.id} already exists`); continue; }

      // Try saving options to detect issues
      for (const o of opts) {
        // Simulate what the importer does
        if (o.is_correct === null || o.is_correct === undefined) {
          console.error(`  ❌ Q${q.id} opt${o.id}: is_correct is NULL`);
          errors++;
        }
        if (!o.text_html && !o.text) {
          console.error(`  ❌ Q${q.id} opt${o.id}: text is empty`);
          errors++;
        }
      }
    } catch (e: any) {
      console.error(`  ❌ Q${q.id}: ${e.message}`);
      errors++;
    }
  }

  // Check for existing questions with same externalId but different bankId (cross-bank collision)
  const allExtIds = questions.map((question) => resolveQuestionExternalId(question));
  const existing = await qRepo
    .createQueryBuilder('q')
    .where('q.externalId IN (:...ids)', { ids: allExtIds.slice(0, 50) })
    .andWhere('q.questionBankId != :bankId', { bankId: qb.id })
    .select(['q.externalId', 'q.questionBankId'])
    .getMany();

  if (existing.length > 0) {
    console.log(`\n⚠️  ${existing.length} externalIds from this DB already exist in OTHER banks:`);
    existing.slice(0, 10).forEach(q => console.log(`    externalId=${q.externalId} in bankId=${q.questionBankId}`));
  } else {
    console.log('\n✅ No cross-bank externalId collisions found');
  }

  console.log(`\nTotal errors found: ${errors}`);
  db.close();
  await app.close();
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
