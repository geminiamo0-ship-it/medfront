import { createConnection } from 'typeorm';
import { PromoCode } from '../entities/promo-code.entity';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedPromoCodes() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [PromoCode],
    synchronize: false,
  });

  const repository = connection.getRepository(PromoCode);

  const codes = [
    { code: 'MEDPARK20', discountPercent: 20 },
    { code: 'LAUNCH50', discountPercent: 50 },
    { code: 'WELCOME10', discountPercent: 10 },
    { code: 'SHADY', discountPercent: 100 },
  ];

  for (const item of codes) {
    const existing = await repository.findOne({ where: { code: item.code } });
    if (!existing) {
      const promo = repository.create({
        ...item,
        isActive: true,
      });
      await repository.save(promo);
      console.log(`Created promo code: ${item.code}`);
    } else {
      console.log(`Promo code already exists: ${item.code}`);
    }
  }

  await connection.close();
}

seedPromoCodes().catch((err) => {
  console.error('Error seeding promo codes:', err);
  process.exit(1);
});
