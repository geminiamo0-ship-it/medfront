import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * DataSource used by:
 *  - NestJS TypeOrmModule (app.module.ts)
 *  - TypeORM CLI  (migration:generate / migration:run / migration:revert)
 *
 * Switch between TS sources (for generate) and compiled JS (for runtime)
 * via the TYPEORM_ENTITIES env var:
 *   TYPEORM_ENTITIES=ts   → reads src/**‌/*.entity.ts  (migration:generate)
 *   (unset)               → reads dist/**‌/*.entity.js  (runtime / migration:run)
 */

const usingTsSources = process.env.TYPEORM_ENTITIES === 'ts';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  entities: usingTsSources
    ? ['src/**/*.entity.ts']
    : ['dist/**/*.entity.js'],

  migrations: usingTsSources
    ? ['src/migrations/*.ts']
    : ['dist/migrations/*.js'],

  migrationsTableName: 'typeorm_migrations',

  // NEVER enable synchronize in production — use migrations instead.
  synchronize: false,

  logging: process.env.NODE_ENV === 'development',

  // SSL for managed Postgres providers (Supabase, RDS, Neon …).
  // Set DB_SSL=true in production .env to enable.
  ...(process.env.DB_SSL === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
