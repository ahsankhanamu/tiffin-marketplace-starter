/**
 * Database initialization script
 * Creates the database if it doesn't exist, runs migrations, and seeds data
 */
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

// Parse DATABASE_URL to extract connection details
// Handles both formats: postgresql://user:pass@host:port/db and postgresql://user:@host:port/db (empty password)
function parseDatabaseUrl(url) {
  // Match with password: postgresql://user:pass@host:port/db
  let match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)(\?.*)?$/);
  
  // If no match, try without password: postgresql://user:@host:port/db
  if (!match) {
    match = url.match(/postgresql:\/\/([^:]+):@([^:]+):(\d+)\/(.+)(\?.*)?$/);
    if (match) {
      return {
        user: match[1],
        password: '',
        host: match[2],
        port: parseInt(match[3], 10),
        database: match[4]
      };
    }
    
    // Try without password at all: postgresql://user@host:port/db
    match = url.match(/postgresql:\/\/([^@]+)@([^:]+):(\d+)\/(.+)(\?.*)?$/);
    if (match) {
      return {
        user: match[1],
        password: '',
        host: match[2],
        port: parseInt(match[3], 10),
        database: match[4]
      };
    }
    
    throw new Error('Invalid DATABASE_URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5]
  };
}

async function createDatabaseIfNotExists() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const dbConfig = parseDatabaseUrl(dbUrl);
  const dbName = dbConfig.database;

  console.log(`📦 Checking if database '${dbName}' exists...`);

  // Connect to postgres database to create the target database
  const adminClient = new Client({
    user: dbConfig.user,
    password: dbConfig.password || undefined, // Use undefined for empty password
    host: dbConfig.host,
    port: dbConfig.port,
    database: 'postgres' // Connect to default postgres database
  });

  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Check if database exists
    const result = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rows.length === 0) {
      console.log(`📝 Creating database '${dbName}'...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database '${dbName}' created successfully`);
    } else {
      console.log(`✅ Database '${dbName}' already exists`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await adminClient.end();
  }
}

async function checkMigrationsExist() {
  const fs = await import('fs');
  const path = await import('path');
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return false;
  }
  const files = fs.readdirSync(migrationsDir);
  return files.length > 0;
}

async function checkPostGISAvailable() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return false;

    const dbConfig = parseDatabaseUrl(dbUrl);
    const testClient = new Client({
      user: dbConfig.user,
      password: dbConfig.password || undefined,
      host: dbConfig.host,
      port: dbConfig.port,
      database: 'postgres'
    });

    await testClient.connect();
    const result = await testClient.query(
      "SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') as available"
    );
    await testClient.end();
    return result.rows[0]?.available || false;
  } catch {
    return false;
  }
}

async function checkPostGISInstalled(database) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return false;

    const dbConfig = parseDatabaseUrl(dbUrl);
    const testClient = new Client({
      user: dbConfig.user,
      password: dbConfig.password || undefined,
      host: dbConfig.host,
      port: dbConfig.port,
      database: database || dbConfig.database
    });

    await testClient.connect();
    const result = await testClient.query(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') as installed"
    );
    await testClient.end();
    return result.rows[0]?.installed || false;
  } catch {
    return false;
  }
}

async function installPostGIS(database) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const dbConfig = parseDatabaseUrl(dbUrl);
    const targetDb = database || dbConfig.database;
    
    console.log(`📦 Installing PostGIS extension in database '${targetDb}'...`);
    
    const client = new Client({
      user: dbConfig.user,
      password: dbConfig.password || undefined,
      host: dbConfig.host,
      port: dbConfig.port,
      database: targetDb
    });

    await client.connect();
    
    // Check if PostGIS is available
    const availableCheck = await client.query(
      "SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') as available"
    );
    
    if (!availableCheck.rows[0]?.available) {
      await client.end();
      console.log('⚠️  PostGIS extension is not available on this PostgreSQL server');
      console.log('   Please install PostGIS on your PostgreSQL server or use Docker with postgis/postgis image');
      return false;
    }
    
    // Check if already installed
    const installedCheck = await client.query(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') as installed"
    );
    
    if (installedCheck.rows[0]?.installed) {
      await client.end();
      console.log(`✅ PostGIS extension is already installed in '${targetDb}'`);
      return true;
    }
    
    // Install PostGIS
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await client.end();
    
    console.log(`✅ PostGIS extension installed successfully in '${targetDb}'`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to install PostGIS:`, error.message);
    return false;
  }
}

async function createInitialMigration() {
  console.log('📝 Creating initial migration...');
  try {
    // Check if PostGIS is available
    console.log('🔍 Checking PostGIS availability...');
    const postgisAvailable = await checkPostGISAvailable();
    
    if (postgisAvailable) {
      console.log('✅ PostGIS is available - will use geometry type for location');
    } else {
      console.log('⚠️  PostGIS is not available - will use TEXT for location');
      console.log('   To enable PostGIS:');
      console.log('   - Use Docker: npm run docker:up (recommended)');
      console.log('   - Or install PostGIS on your local PostgreSQL');
    }

    // Create migration without applying it
    execSync('npx prisma migrate dev --name init --create-only', {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: process.env
    });
    
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      throw new Error('Migrations directory was not created');
    }
    
    const migrationDirs = fs.readdirSync(migrationsDir).filter(f => {
      const fullPath = path.join(migrationsDir, f);
      return fs.statSync(fullPath).isDirectory();
    });
    
    if (migrationDirs.length === 0) {
      throw new Error('No migration directory was created');
    }
    
    const latestMigration = migrationDirs.sort().reverse()[0];
    const migrationFile = path.join(migrationsDir, latestMigration, 'migration.sql');
    
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    let migrationContent = fs.readFileSync(migrationFile, 'utf8');
    
    if (postgisAvailable) {
      // Add PostGIS extension at the beginning if not already present
      if (!migrationContent.includes('CREATE EXTENSION IF NOT EXISTS postgis')) {
        migrationContent = '-- Enable PostGIS extension\nCREATE EXTENSION IF NOT EXISTS postgis;\n\n' + migrationContent;
      }
      
      // Update Kitchen.location to use PostGIS geometry instead of TEXT
      if (migrationContent.includes('CREATE TABLE "Kitchen"')) {
        migrationContent = migrationContent.replace(
          /"location" TEXT/,
          '"location" geometry(Point,4326)'
        );
      }
      console.log('✅ Added PostGIS extension and geometry type to migration');
    } else {
      // Keep TEXT type for location if PostGIS is not available
      console.log('✅ Migration created with TEXT type for location (PostGIS not available)');
    }
    
    fs.writeFileSync(migrationFile, migrationContent, 'utf8');
    console.log('✅ Initial migration created');
  } catch (error) {
    console.error('❌ Failed to create migration:', error.message);
    throw error;
  }
}

async function fixFailedMigration() {
  const fs = await import('fs');
  const path = await import('path');
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    return false;
  }
  
  const migrationDirs = fs.readdirSync(migrationsDir).filter(f => {
    const fullPath = path.join(migrationsDir, f);
    return fs.statSync(fullPath).isDirectory();
  });
  
  if (migrationDirs.length === 0) {
    return false;
  }
  
  const latestMigration = migrationDirs.sort().reverse()[0];
  const migrationFile = path.join(migrationsDir, latestMigration, 'migration.sql');
  
  if (!fs.existsSync(migrationFile)) {
    return false;
  }
  
  let migrationContent = fs.readFileSync(migrationFile, 'utf8');
  
  // Check if migration has PostGIS but PostGIS is not available
  const hasPostGIS = migrationContent.includes('CREATE EXTENSION IF NOT EXISTS postgis') || 
                     migrationContent.includes('geometry(Point,4326)');
  
  if (hasPostGIS) {
    const postgisAvailable = await checkPostGISAvailable();
    
    if (!postgisAvailable) {
      console.log('🔧 Fixing migration: Removing PostGIS (not available)...');
      
      // Remove PostGIS extension line
      migrationContent = migrationContent.replace(
        /-- Enable PostGIS extension\nCREATE EXTENSION IF NOT EXISTS postgis;\n\n?/g,
        ''
      );
      
      // Replace geometry with TEXT
      migrationContent = migrationContent.replace(
        /"location" geometry\(Point,4326\)/g,
        '"location" TEXT'
      );
      
      fs.writeFileSync(migrationFile, migrationContent, 'utf8');
      console.log('✅ Migration fixed - PostGIS removed, using TEXT for location');
      return true;
    }
  }
  
  return false;
}

async function resolveFailedMigration() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      return false;
    }
    
    const migrationDirs = fs.readdirSync(migrationsDir).filter(f => {
      const fullPath = path.join(migrationsDir, f);
      return fs.statSync(fullPath).isDirectory();
    });
    
    if (migrationDirs.length === 0) {
      return false;
    }
    
    const latestMigration = migrationDirs.sort().reverse()[0];
    
    // Try to resolve the failed migration
    try {
      execSync(`npx prisma migrate resolve --applied ${latestMigration}`, {
        stdio: 'pipe',
        cwd: process.cwd(),
        env: process.env
      });
      return true;
    } catch {
      // If resolve fails, that's okay - we'll try migrate dev
      return false;
    }
  } catch {
    return false;
  }
}

async function runMigrations() {
  console.log('🔄 Running Prisma migrations...');
  try {
    const migrationsExist = await checkMigrationsExist();
    
    if (!migrationsExist) {
      await createInitialMigration();
    } else {
      // Check if we need to fix an existing migration
      const fixed = await fixFailedMigration();
      
      if (fixed) {
        // If we fixed the migration, try to resolve any failed migration state
        console.log('🔄 Resolving migration state...');
        await resolveFailedMigration();
      }
    }
    
    // Apply migrations
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    console.log('✅ Migrations completed');
  } catch (error) {
    // If migration still fails, try using migrate dev instead
    if (error.message.includes('migration failed to apply')) {
      console.log('⚠️  Migration deploy failed, trying migrate dev...');
      try {
        execSync('npx prisma migrate dev', {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: process.env
        });
        console.log('✅ Migrations completed');
      } catch (devError) {
        console.error('❌ Migration failed:', devError.message);
        console.log('\n💡 Options:');
        console.log('   1. Use Docker with PostGIS: npm run docker:up');
        console.log('   2. Install PostGIS on your local PostgreSQL');
        console.log('   3. Reset migrations: npx prisma migrate reset');
        throw devError;
      }
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }
}

async function generatePrismaClient() {
  console.log('🔧 Generating Prisma client...');
  try {
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    console.log('✅ Prisma client generated');
  } catch (error) {
    console.error('❌ Prisma client generation failed:', error.message);
    throw error;
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding database...');
  try {
    // Run seed script using execSync to execute it properly
    execSync('node src/seed.js', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env
    });
    console.log('✅ Database seeded');
  } catch (error) {
    console.error('⚠️  Warning: Seeding failed:', error.message);
    console.log('   You can run seeding manually with: npm run prisma:seed');
  }
}

async function checkDockerConnection() {
  try {
    execSync('docker ps', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function verifyDatabaseConnection() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const dbConfig = parseDatabaseUrl(dbUrl);
    // Connect to 'postgres' database first to verify server connection
    const testClient = new Client({
      user: dbConfig.user,
      password: dbConfig.password || undefined,
      host: dbConfig.host,
      port: dbConfig.port,
      database: 'postgres' // Connect to default database
    });

    await testClient.connect();
    await testClient.end();
    return true;
  } catch (error) {
    console.error('❌ Cannot connect to PostgreSQL server:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure PostgreSQL is running');
    console.log('   2. If using Docker, run: npm run docker:up');
    console.log('   3. Check your DATABASE_URL in .env file');
    console.log('   4. Verify PostgreSQL is accessible at the host/port specified');
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting database initialization...\n');

  try {
    // Check Docker (optional, just for info)
    const dockerRunning = await checkDockerConnection();
    if (!dockerRunning) {
      console.log('ℹ️  Docker is not running (this is okay if using local PostgreSQL)\n');
    }

    // Verify database connection first
    console.log('🔌 Verifying database connection...');
    await verifyDatabaseConnection();
    console.log('✅ Database connection verified\n');

    // Step 1: Create database if it doesn't exist
    await createDatabaseIfNotExists();
    console.log('');

    // Step 1.5: Install PostGIS if available
    const dbUrl = process.env.DATABASE_URL;
    const dbConfig = parseDatabaseUrl(dbUrl);
    const postgisAvailable = await checkPostGISAvailable();
    
    if (postgisAvailable) {
      const postgisInstalled = await checkPostGISInstalled(dbConfig.database);
      if (!postgisInstalled) {
        await installPostGIS(dbConfig.database);
        console.log('');
      } else {
        console.log('✅ PostGIS extension is already installed\n');
      }
    } else {
      console.log('⚠️  PostGIS is not available on this PostgreSQL server');
      console.log('   Location will be stored as TEXT instead of geometry\n');
    }

    // Step 2: Generate Prisma client (needed before migrations)
    await generatePrismaClient();
    console.log('');

    // Step 3: Run migrations (includes PostGIS setup)
    await runMigrations();
    console.log('');

    // Step 5: Seed database
    await seedDatabase();
    console.log('');

    console.log('🎉 Database initialization completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   - Start the server: npm run dev');
    console.log('   - View data in Prisma Studio: npm run prisma:studio');
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

main();

