/**
 * Fix migrations - manually apply migration if it was marked as applied but tables don't exist
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkTablesExist() {
  try {
    const result = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations'
    `;
    return result.length > 0;
  } catch (error) {
    return false;
  }
}

async function checkMigrationApplied() {
  try {
    const result = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations 
      ORDER BY finished_at DESC 
      LIMIT 1
    `;
    if (result.length === 0) return false;
    const migration = result[0];
    // Migration is applied if it has a finished_at and wasn't rolled back
    return migration.finished_at !== null && migration.rolled_back_at === null;
  } catch (error) {
    return false;
  }
}

async function applyMigrationManually() {
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
  const fs = await import('fs');
  
  const migrationDirs = fs.readdirSync(migrationsDir).filter(f => {
    const fullPath = join(migrationsDir, f);
    return fs.statSync(fullPath).isDirectory();
  });
  
  if (migrationDirs.length === 0) {
    throw new Error('No migrations found');
  }
  
  const latestMigration = migrationDirs.sort().reverse()[0];
  const migrationFile = join(migrationsDir, latestMigration, 'migration.sql');
  
  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }
  
  const migrationSQL = readFileSync(migrationFile, 'utf8');
  
  console.log(`📝 Applying migration: ${latestMigration}`);
  await prisma.$executeRawUnsafe(migrationSQL);
  console.log('✅ Migration applied successfully');
}

async function main() {
  try {
    console.log('🔍 Checking database state...\n');
    
    const tablesExist = await checkTablesExist();
    const migrationApplied = await checkMigrationApplied();
    
    console.log(`Tables exist: ${tablesExist}`);
    console.log(`Migration marked as applied: ${migrationApplied}\n`);
    
    if (!tablesExist && migrationApplied) {
      console.log('⚠️  Migration was marked as applied but tables don\'t exist!');
      console.log('🔧 Applying migration manually...\n');
      await applyMigrationManually();
      console.log('\n✅ Database fixed! Tables should now exist.');
    } else if (!tablesExist) {
      console.log('📝 No tables exist. Applying migration...\n');
      await applyMigrationManually();
      console.log('\n✅ Migration applied! Tables should now exist.');
    } else if (tablesExist) {
      console.log('✅ Database is properly initialized!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

