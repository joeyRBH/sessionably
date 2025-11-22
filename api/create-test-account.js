// Emergency test account creator - creates a test client portal account
const { initDatabase, executeQuery } = require('./utils/database-connection');
const bcrypt = require('bcrypt');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigin = process.env.APP_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDatabase();

    // Create test client if doesn't exist
    let clientResult = await executeQuery(
      `SELECT id FROM clients WHERE email = $1`,
      ['testpatient@sessionably.com']
    );

    let clientId;
    if (!clientResult.success || clientResult.data.length === 0) {
      // Create test client
      clientResult = await executeQuery(
        `INSERT INTO clients (name, email, phone, date_of_birth, status, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id`,
        ['Test Patient', 'testpatient@sessionably.com', '555-123-4567', '1990-01-01', 'active']
      );

      if (!clientResult.success) {
        throw new Error('Failed to create client: ' + clientResult.error);
      }

      clientId = clientResult.data[0].id;
    } else {
      clientId = clientResult.data[0].id;
    }

    // Check if client_user already exists
    const existingUser = await executeQuery(
      `SELECT id FROM client_users WHERE client_id = $1`,
      [clientId]
    );

    let accountAlreadyExisted = false;

    if (existingUser.success && existingUser.data.length > 0) {
      accountAlreadyExisted = true;
      console.log('Test account already exists, adding sample data...');
    } else {
      // Create password hash
      const passwordHash = await bcrypt.hash('testpassword123', 10);

      // Create client_user
      const createUserResult = await executeQuery(
        `INSERT INTO client_users (client_id, email, password_hash, is_active, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [clientId, 'testpatient@sessionably.com', passwordHash]
      );

      if (!createUserResult.success) {
        throw new Error('Failed to create user: ' + createUserResult.error);
      }
    }

    // Create default notification settings
    await executeQuery(
      `INSERT INTO client_notification_settings (client_id, created_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (client_id) DO NOTHING`,
      [clientId]
    );

    // CREATE SAMPLE DATA FOR TESTING

    // 1. Create upcoming appointments
    await executeQuery(
      `INSERT INTO appointments (client_id, title, description, appointment_date, appointment_time, duration_minutes, status, provider, appointment_type, created_at)
       VALUES
       ($1, 'Initial Consultation', 'First visit consultation', CURRENT_DATE + INTERVAL '3 days', '10:00', 60, 'scheduled', 'Dr. Smith', 'consultation', CURRENT_TIMESTAMP),
       ($1, 'Follow-up Session', 'Follow-up therapy session', CURRENT_DATE + INTERVAL '10 days', '14:30', 50, 'scheduled', 'Dr. Johnson', 'therapy', CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [clientId]
    );

    // 2. Create past appointment
    await executeQuery(
      `INSERT INTO appointments (client_id, title, description, appointment_date, appointment_time, duration_minutes, status, provider, appointment_type, created_at)
       VALUES
       ($1, 'Initial Assessment', 'Intake assessment completed', CURRENT_DATE - INTERVAL '7 days', '09:00', 60, 'completed', 'Dr. Smith', 'assessment', CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [clientId]
    );

    // 3. Create invoices
    await executeQuery(
      `INSERT INTO invoices (client_id, invoice_number, invoice_date, due_date, total_amount, status, description, created_at)
       VALUES
       ($1, 'INV-TEST-001', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 150.00, 'pending', 'Initial consultation fee', CURRENT_TIMESTAMP),
       ($1, 'INV-TEST-002', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '15 days', 200.00, 'paid', 'Assessment session', CURRENT_TIMESTAMP)
       ON CONFLICT (invoice_number) DO NOTHING`,
      [clientId]
    );

    // 4. Create documents
    const docResult = await executeQuery(
      `SELECT id FROM documents WHERE is_template = true LIMIT 3`
    );

    if (docResult.success && docResult.data.length > 0) {
      for (const doc of docResult.data) {
        await executeQuery(
          `INSERT INTO assigned_documents (client_id, document_id, access_code, status, assigned_at, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT DO NOTHING`,
          [clientId, doc.id, `TEST-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
           docResult.data.indexOf(doc) === 0 ? 'pending' : 'signed']
        );
      }
    }

    // 5. Create test messages
    await executeQuery(
      `INSERT INTO client_messages (client_id, subject, message, message_type, priority, is_read, sender_name, created_at)
       VALUES
       ($1, 'Welcome to Your Portal', 'Welcome! Your patient portal is now active. You can view appointments, invoices, and documents here.', 'general', 'normal', false, 'Admin', CURRENT_TIMESTAMP),
       ($1, 'Appointment Reminder', 'This is a reminder about your upcoming appointment.', 'appointment', 'high', true, 'Dr. Smith Office', CURRENT_TIMESTAMP - INTERVAL '2 days')
       ON CONFLICT DO NOTHING`,
      [clientId]
    );

    return res.status(200).json({
      success: true,
      message: accountAlreadyExisted
        ? 'Test account refreshed with sample data!'
        : 'Test account created successfully with sample data!',
      credentials: {
        email: 'testpatient@sessionably.com',
        password: 'testpassword123',
        note: 'Use these credentials to log in at /client-portal.html'
      },
      sampleData: {
        appointments: 3,
        invoices: 2,
        documents: docResult.data.length,
        messages: 2
      },
      accountStatus: accountAlreadyExisted ? 'existing' : 'new'
    });

  } catch (error) {
    console.error('Error creating test account:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create test account',
      details: error.message
    });
  }
}
