import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { USMLEStep } from '../entities/question-bank.entity';
import {
  resolveImportTargetContext,
  resolveStepDir,
  scanStepFolder,
  StepImporter,
  type ImportStep,
} from './import-step';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    filterStep: args.includes('--step') ? Number(args[args.indexOf('--step') + 1]) : null,
    skipExisting: args.includes('--skip-existing'),
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const opts = parseArgs();
  const steps: ImportStep[] = [
    USMLEStep.STEP_1,
    USMLEStep.STEP_2,
    USMLEStep.STEP_3,
    USMLEStep.MRCP_PART_1,
    USMLEStep.MRCP_PART_2,
  ];

  const selectedSteps = opts.filterStep
    ? steps.filter((step) => step === opts.filterStep)
    : steps;

  console.log(`\n${'='.repeat(64)}`);
  console.log('  MedPark - Master Question Bank Importer');
  console.log('='.repeat(64));
  console.log(`  Targets: ${selectedSteps.length}`);
  console.log(`  Skip existing: ${opts.skipExisting}`);
  console.log(`  Dry run: ${opts.dryRun}`);
  console.log(`${'='.repeat(64)}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);
  const importer = new StepImporter(dataSource);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const step of selectedSteps) {
    const target = resolveImportTargetContext(step);
    const stepDir = resolveStepDir(step);
    const banks = scanStepFolder(stepDir, step);

    console.log(`\n${'-'.repeat(64)}`);
    console.log(`${target.label} (${banks.length} banks)`);
    console.log(`Directory: ${stepDir}`);
    console.log('-'.repeat(64));

    if (banks.length === 0) {
      console.error(`No databases found for ${target.label}`);
      totalErrors++;
      continue;
    }

    banks.forEach((bank, index) => {
      console.log(`  [${index + 1}] ${bank.bankName}`);
      console.log(`       Code: ${bank.bankCode}`);
      console.log(`       Path: ${bank.dbPath}`);
    });

    if (opts.dryRun) {
      continue;
    }

    for (const bank of banks) {
      const startedAt = Date.now();
      try {
        const { imported, skipped, errors } = await importer.importBank(
          bank,
          opts.skipExisting,
        );
        totalImported += imported;
        totalSkipped += skipped;
        totalErrors += errors;
        console.log(
          `  ${bank.bankCode}: ${imported} imported, ${skipped} skipped, ${errors} errors (${(
            (Date.now() - startedAt) /
            1000
          ).toFixed(1)}s)`,
        );
      } catch (error: any) {
        totalErrors++;
        console.error(`  ${bank.bankCode} failed: ${error.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(64)}`);
  console.log('  FINAL IMPORT SUMMARY');
  console.log('='.repeat(64));
  console.log(`  Imported: ${totalImported.toLocaleString()} questions`);
  console.log(`  Skipped: ${totalSkipped.toLocaleString()} questions`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`${'='.repeat(64)}\n`);

  await app.close();
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
