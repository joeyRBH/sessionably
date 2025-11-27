// Database Migrations Runner
// Manages and executes database migrations in order

const { initDatabase, executeQuery } = require('./utils/database-connection');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initDatabase();

    // Create migrations table if it doesn't exist
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of completed migrations
    const completedResult = await executeQuery(
      'SELECT name FROM migrations ORDER BY executed_at'
    );

    const completedMigrations = completedResult.data.map(m => m.name);

    // Define migrations in order
    const migrations = [
      {
        name: '001_create_clients_table',
        sql: `
          CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            date_of_birth DATE,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            emergency_contact VARCHAR(255),
            emergency_phone VARCHAR(50),
            stripe_customer_id VARCHAR(255) UNIQUE,
            autopay_enabled BOOLEAN DEFAULT false,
            status VARCHAR(50) DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT clients_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$' OR email IS NULL)
          );

          CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
          CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer ON clients(stripe_customer_id);
          CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
        `
      },
      {
        name: '002_create_appointments_table',
        sql: `
          CREATE TABLE IF NOT EXISTS appointments (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL DEFAULT 'Session',
            description TEXT,
            appointment_date DATE NOT NULL,
            appointment_time TIME NOT NULL,
            duration_minutes INTEGER DEFAULT 60,
            status VARCHAR(50) DEFAULT 'scheduled',
            location VARCHAR(255),
            provider VARCHAR(255),
            appointment_type VARCHAR(100),
            cpt_code VARCHAR(10),
            notes TEXT,
            reminder_sent BOOLEAN DEFAULT false,
            completed_at TIMESTAMP,
            modality VARCHAR(50) DEFAULT 'in-person',
            telehealth_room_id VARCHAR(255),
            telehealth_link TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
          CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
          CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
        `
      }
    ];

    // GET: Return migration status
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        data: {
          total: migrations.length,
          completed: completedMigrations.length,
          pending: migrations.filter(m => !completedMigrations.includes(m.name)),
          completedList: completedMigrations
        }
      });
    }

    // POST: Run pending migrations
    const results = [];
    for (const migration of migrations) {
      if (!completedMigrations.includes(migration.name)) {
        try {
          await executeQuery(migration.sql);
          await executeQuery(
            'INSERT INTO migrations (name) VALUES ($1)',
            [migration.name]
          );
          results.push({
            name: migration.name,
            status: 'completed',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          results.push({
            name: migration.name,
            status: 'failed',
            error: error.message
          });
          // Stop on first error
          break;
        }
      } else {
        results.push({
          name: migration.name,
          status: 'already_completed'
        });
      }
    }

    const newMigrations = results.filter(r => r.status === 'completed').length;

    return res.status(200).json({
      success: true,
      message: newMigrations > 0
        ? `Successfully ran ${newMigrations} migration(s)`
        : 'All migrations already completed',
      data: {
        results,
        totalMigrations: migrations.length,
        completedMigrations: completedMigrations.length + newMigrations
      }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
}
