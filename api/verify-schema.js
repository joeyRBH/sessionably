// Schema Verification Endpoint
// Checks if all required columns exist in the appointments table

export default async function handler(req, res) {
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

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

    // Check appointments table columns
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `;

    const columnNames = columns.map(c => c.column_name);

    // Required columns for appointments to work
    const requiredColumns = [
      'id',
      'client_id',
      'title',
      'appointment_date',
      'appointment_time',
      'duration_minutes',
      'appointment_type',
      'cpt_code',
      'notes',
      'status',
      'modality',
      'telehealth_room_id',
      'telehealth_link'
    ];

    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    const hasAllColumns = missingColumns.length === 0;

    await sql.end();

    return res.status(200).json({
      success: true,
      schema_valid: hasAllColumns,
      table: 'appointments',
      total_columns: columns.length,
      columns: columns.map(c => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        default: c.column_default
      })),
      required_columns: requiredColumns,
      missing_columns: missingColumns,
      status: hasAllColumns ? '✅ All required columns present' : '❌ Missing columns - run /api/setup-database'
    });

  } catch (error) {
    console.error('Schema verification error:', error);
    return res.status(500).json({
      error: 'Verification failed',
      message: error.message
    });
  }
}
