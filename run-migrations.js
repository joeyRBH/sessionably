// Migration Runner for Sessionably
// Run this with: node run-migrations.js

const fs = require('fs');
const postgres = require('postgres');

// Your Crunchy Bridge connection string
const DATABASE_URL = 'postgres://application:KroHm2EPRm7rwiCAnEFv8D4ERWtk37NcTf52R99LPXeCFEQkUJtbrTrrIoQdxEf7@p.rlqafgefofftpkivbewroi3b6e.db.postgresbridge.com:5432/postgres?sslmode=require';

console.log('🚀 Sessionably - Running Migrations\n');

async function runMigrations() {
  let sql;

  try {
    // Connect to database
    sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 30
    });

    console.log('✅ Connected to database\n');

    // Migration 1: Client Management
    console.log('📄 Running 001-client-mgmt.sql...');
    const migration1 = fs.readFileSync('./sql/migrations/001-client-mgmt.sql', 'utf8');
    await sql.unsafe(migration1);
    console.log('✅ Client management tables created\n');

    // Migration 2: Scheduling
    console.log('📄 Running 002-scheduling.sql...');
    const migration2 = fs.readFileSync('./sql/migrations/002-scheduling.sql', 'utf8');
    await sql.unsafe(migration2);
    console.log('✅ Scheduling tables created\n');

    // Verify tables were created
    console.log('🔍 Verifying new tables...');
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('clients_v2', 'appointments')
      ORDER BY tablename
    `;

    console.log(`\n✅ Found ${tables.length} new tables:`);
    tables.forEach(t => console.log(`   - ${t.tablename}`));

    console.log('\n🎉 Migrations completed successfully!\n');

    await sql.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);

    if (sql) await sql.end();
    process.exit(1);
  }
}

runMigrations();
