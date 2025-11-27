// Migration: Add missing columns to appointments table
// Run this once at: /api/migrate-appointments

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

    // Add missing columns to appointments table
    const migrations = [
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(10)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS modality VARCHAR(50) DEFAULT 'in-person'`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_room_id VARCHAR(255)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_link TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`
    ];

    for (const migration of migrations) {
      await sql.unsafe(migration);
    }

    // Get updated table structure
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `;

    await sql.end();

    return res.status(200).json({
      success: true,
      message: '✅ Appointments table migration complete!',
      addedColumns: [
        'cpt_code',
        'modality',
        'telehealth_room_id',
        'telehealth_link',
        'completed_at'
      ],
      currentColumns: columns.map(c => `${c.column_name} (${c.data_type})`)
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
}
