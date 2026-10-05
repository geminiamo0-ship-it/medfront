import dataSource from './src/config/typeorm.config';

async function main() {
  const ds = await dataSource.initialize();
  
  // Check specific IDs from user's file
  const ids = [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,26,27,28,29,30,31,32,33,34,35,36,37,38,40,41,42,45,48,49];
  const rows = await ds.query(
    `SELECT id, name, step, "totalQuestions", "isBlockBank", "blockSize"
     FROM question_banks
     WHERE id = ANY($1)
     ORDER BY step, id`,
    [ids]
  );
  for (const row of rows) {
    console.log(`id=${row.id} | step=${row.step} | isBlockBank=${row.isBlockBank} | blockSize=${row.blockSize} | total=${row.totalQuestions} | ${row.name}`);
  }
  console.log(`\nTotal: ${rows.length}`);
  await ds.destroy();
}

main().catch(console.error);
