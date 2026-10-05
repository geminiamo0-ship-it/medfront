import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { QuestionBank } from '../entities/question-bank.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(QuestionBank);

  const banks = await repo.find({
    select: ['id', 'code', 'name', 'step', 'isActive', 'isBlockBank'],
    order: { step: 'ASC' as any, code: 'ASC' as any },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(banks, null, 2));
  await app.close();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

