// Quick Fix: Add missing columns to appointments table
// Run this once at: /api/fix-appointments-columns

export default async function handler(req, res) {
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'DATABASE_URL not configured'
      });
    }

    const postgres = require('postgres');
    const sql = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 30
    });

    // Check current columns first
    const columnsBefore = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `;

    const columnsBeforeNames = columnsBefore.map(c => c.column_name);

    // Add each column individually (each in its own transaction)
    const alterResults = [];

    const alterStatements = [
      { col: 'cpt_code', sql: 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(10)' },
      { col: 'modality', sql: 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS modality VARCHAR(50) DEFAULT \'in-person\'' },
      { col: 'telehealth_room_id', sql: 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_room_id VARCHAR(255)' },
      { col: 'telehealth_link', sql: 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_link TEXT' },
      { col: 'completed_at', sql: 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP' }
    ];

    for (const stmt of alterStatements) {
      try {
        await sql.unsafe(stmt.sql);
        alterResults.push({ column: stmt.col, status: 'added' });
      } catch (err) {
        alterResults.push({ column: stmt.col, status: 'error', error: err.message });
      }
    }

    // Check columns after
    const columnsAfter = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `;

    const columnsAfterNames = columnsAfter.map(c => c.column_name);
    const newColumns = columnsAfterNames.filter(c => !columnsBeforeNames.includes(c));

    const requiredColumns = ['cpt_code', 'modality', 'telehealth_room_id', 'telehealth_link'];
    const missingColumns = requiredColumns.filter(col => !columnsAfterNames.includes(col));

    await sql.end();

    return res.status(200).json({
      success: missingColumns.length === 0,
      message: missingColumns.length === 0
        ? '✅ All required columns are present!'
        : '❌ Some columns are still missing',
      before: {
        total: columnsBeforeNames.length,
        columns: columnsBeforeNames
      },
      after: {
        total: columnsAfterNames.length,
        columns: columnsAfterNames
      },
      changes: {
        new_columns: newColumns,
        alter_results: alterResults
      },
      validation: {
        required_columns: requiredColumns,
        missing_columns: missingColumns,
        all_present: missingColumns.length === 0
      }
    });

  } catch (error) {
    console.error('Fix columns error:', error);
    return res.status(500).json({
      error: 'Failed to add columns',
      message: error.message
    });
  }
}
