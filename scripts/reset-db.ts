/**
 * reset-db.ts
 *
 * Drops ALL objects in the public schema and recreates it clean.
 * Run this in development when you want a fresh start before migrations.
 *
 * Usage:
 *   npm run db:reset
 *
 * ⚠️  WARNING: This destroys ALL data. Dev only.
 */

import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/config/typeorm.config';

config();

async function resetDatabase() {
  console.log('⚠️  Resetting database — all data will be lost...\n');

  const ds = new DataSource({
    ...dataSourceOptions,
    // No entities/migrations needed for this operation
    entities: [],
    migrations: [],
    synchronize: false,
  });

  await ds.initialize();
  console.log('✅ Connected to database');

  try {
    // Drop the entire public schema (removes all tables, types, sequences, etc.)
    await ds.query('DROP SCHEMA public CASCADE');
    console.log('✅ Dropped public schema');

    // Recreate it clean
    await ds.query('CREATE SCHEMA public');
    console.log('✅ Recreated public schema');

    // Restore default privileges
    await ds.query('GRANT ALL ON SCHEMA public TO PUBLIC');
    console.log('✅ Restored schema privileges\n');

    console.log('🎉 Database reset complete!');
    console.log('   Now run: npm run migration:run');
  } catch (err) {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  } finally {
    await ds.destroy();
  }
}

resetDatabase();
