// Database Setup API Endpoint
// Visit this URL ONCE to create all database tables
// Example: https://your-app.vercel.app/api/setup-database

// Embedded schema (no file reading needed for Vercel)
const SCHEMA_SQL = `-- Sessionably Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_stripe_customer ON clients(stripe_customer_id);
CREATE INDEX idx_clients_status ON clients(status);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
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
    modality VARCHAR(50) DEFAULT 'in-person',
    telehealth_room_id VARCHAR(255),
    telehealth_link TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Add missing columns to existing appointments table (if it already exists)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(10);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS modality VARCHAR(50) DEFAULT 'in-person';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_room_id VARCHAR(255);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telehealth_link TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(10, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    payment_date DATE,
    stripe_payment_intent_id VARCHAR(255),
    autopay_attempted BOOLEAN DEFAULT false,
    autopay_result JSONB,
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_payment_intent ON invoices(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);

CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'card',
    last4 VARCHAR(4),
    brand VARCHAR(50),
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    is_autopay_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payment_methods_client ON payment_methods(client_id);
CREATE INDEX idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(client_id, is_default);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    stripe_charge_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    refund_amount DECIMAL(10, 2),
    refund_reason TEXT,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_transactions_invoice ON payment_transactions(invoice_id);
CREATE INDEX idx_transactions_client ON payment_transactions(client_id);
CREATE INDEX idx_transactions_type ON payment_transactions(type);
CREATE INDEX idx_transactions_status ON payment_transactions(status);
CREATE INDEX idx_transactions_created ON payment_transactions(created_at);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100),
    file_path VARCHAR(500),
    file_url TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_template BOOLEAN DEFAULT false,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_template ON documents(is_template);

CREATE TABLE IF NOT EXISTS assigned_documents (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    access_code VARCHAR(100) UNIQUE NOT NULL,
    access_code_expires_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    viewed_at TIMESTAMP,
    signed_at TIMESTAMP,
    signature_data TEXT,
    assigned_by VARCHAR(255),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, document_id)
);
CREATE INDEX idx_assigned_docs_client ON assigned_documents(client_id);
CREATE INDEX idx_assigned_docs_document ON assigned_documents(document_id);
CREATE INDEX idx_assigned_docs_access_code ON assigned_documents(access_code);
CREATE INDEX idx_assigned_docs_status ON assigned_documents(status);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    user_type VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, user_type);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assigned_documents_updated_at BEFORE UPDATE ON assigned_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO users (username, password_hash, email, full_name, role)
VALUES ('admin', '$2a$10$rK8qU5P8kZQxVZ9z9K7qYOqGZxJ8ZqK4K5q8K7qYOqGZxJ8ZqK4K5', 'admin@sessionably.com', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO documents (title, description, document_type, is_template, content)
VALUES
    ('Informed Consent', 'Standard informed consent form for treatment', 'consent', true, 'I hereby consent to treatment...'),
    ('HIPAA Notice', 'Notice of Privacy Practices', 'legal', true, 'Your health information privacy is important...'),
    ('Treatment Agreement', 'Agreement for ongoing treatment', 'agreement', true, 'This agreement outlines the terms of treatment...')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW v_clients_with_payment_status AS
SELECT c.*, COUNT(DISTINCT i.id) as total_invoices,
    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN i.status IN ('pending', 'overdue') THEN i.total_amount ELSE 0 END) as total_outstanding,
    MAX(i.payment_date) as last_payment_date
FROM clients c LEFT JOIN invoices i ON c.id = i.client_id
WHERE c.status = 'active' GROUP BY c.id;

CREATE OR REPLACE VIEW v_upcoming_appointments AS
SELECT a.*, c.name as client_name, c.email as client_email, c.phone as client_phone
FROM appointments a JOIN clients c ON a.client_id = c.id
WHERE a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled'
ORDER BY a.appointment_date, a.appointment_time;

CREATE OR REPLACE VIEW v_revenue_summary AS
SELECT DATE_TRUNC('month', payment_date) as month, COUNT(*) as paid_invoices,
    SUM(total_amount) as total_revenue, AVG(total_amount) as avg_invoice_amount
FROM invoices WHERE status = 'paid'
GROUP BY DATE_TRUNC('month', payment_date) ORDER BY month DESC;

-- CLIENT PORTAL TABLES
CREATE TABLE IF NOT EXISTS client_users (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    last_login TIMESTAMP,
    last_login_ip VARCHAR(50),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id)
);
CREATE INDEX IF NOT EXISTS idx_client_users_email ON client_users(email);
CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON client_users(client_id);

CREATE TABLE IF NOT EXISTS client_notification_settings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    email_appointment_reminders BOOLEAN DEFAULT true,
    email_appointment_confirmations BOOLEAN DEFAULT true,
    email_invoice_reminders BOOLEAN DEFAULT true,
    email_payment_receipts BOOLEAN DEFAULT true,
    email_document_updates BOOLEAN DEFAULT true,
    email_marketing BOOLEAN DEFAULT false,
    sms_notifications BOOLEAN DEFAULT false,
    sms_appointment_reminders BOOLEAN DEFAULT false,
    sms_appointment_confirmations BOOLEAN DEFAULT false,
    sms_invoice_reminders BOOLEAN DEFAULT false,
    sms_payment_receipts BOOLEAN DEFAULT false,
    preferred_contact_method VARCHAR(50) DEFAULT 'email',
    reminder_advance_hours INTEGER DEFAULT 24,
    notification_frequency VARCHAR(50) DEFAULT 'realtime',
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS notification_log (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    notification_type VARCHAR(100) NOT NULL,
    notification_category VARCHAR(100),
    subject VARCHAR(255),
    message TEXT,
    delivery_method VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    related_entity_type VARCHAR(100),
    related_entity_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_log_client ON notification_log(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status);

CREATE TABLE IF NOT EXISTS client_messages (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(50) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    sender_type VARCHAR(50),
    sender_id INTEGER,
    sender_name VARCHAR(255),
    related_entity_type VARCHAR(100),
    related_entity_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_client_messages_client ON client_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_read ON client_messages(is_read);

CREATE TABLE IF NOT EXISTS client_sessions (
    id SERIAL PRIMARY KEY,
    client_user_id INTEGER REFERENCES client_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_type VARCHAR(50),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_client_sessions_user ON client_sessions(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_token ON client_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_client_sessions_expires ON client_sessions(expires_at);

CREATE TRIGGER update_client_users_updated_at BEFORE UPDATE ON client_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_notification_settings_updated_at BEFORE UPDATE ON client_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AI CLINICAL NOTETAKER TABLES
CREATE TABLE IF NOT EXISTS clinical_notes (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    session_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_type VARCHAR(50) DEFAULT 'individual',
    note_format VARCHAR(50) NOT NULL,
    transcript TEXT,
    clinical_note TEXT NOT NULL,
    audio_file_url VARCHAR(500),
    duration_seconds INTEGER,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMP,
    signed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    signature_data TEXT,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_clinical_notes_client ON clinical_notes(client_id);
CREATE INDEX idx_clinical_notes_appointment ON clinical_notes(appointment_id);
CREATE INDEX idx_clinical_notes_session_date ON clinical_notes(session_date);
CREATE INDEX idx_clinical_notes_created_by ON clinical_notes(created_by);
CREATE INDEX idx_clinical_notes_signed ON clinical_notes(is_signed);

CREATE TABLE IF NOT EXISTS note_audit_log (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES clinical_notes(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_type VARCHAR(50),
    user_name VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    changes JSONB,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_note_audit_log_note ON note_audit_log(note_id);
CREATE INDEX idx_note_audit_log_action ON note_audit_log(action);
CREATE INDEX idx_note_audit_log_user ON note_audit_log(user_id);
CREATE INDEX idx_note_audit_log_created ON note_audit_log(created_at);

CREATE TRIGGER update_clinical_notes_updated_at BEFORE UPDATE ON clinical_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add AI consent tracking to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_signed BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_signed_at TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_consent_signature_data TEXT;

-- CLINICAL TREATMENT PLANS TABLE
CREATE TABLE IF NOT EXISTS treatment_plans (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Clinical content fields
    diagnoses TEXT NOT NULL,
    presenting_problems TEXT NOT NULL,
    goals TEXT NOT NULL,
    objective_data TEXT,
    treatment_frequency VARCHAR(255) NOT NULL,

    -- Additional clinical fields
    plan_date DATE DEFAULT CURRENT_DATE,
    review_date DATE,
    status VARCHAR(50) DEFAULT 'active',

    -- Signature and locking (REQUIRED for clinical documents)
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMP,
    signed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    signature_data TEXT,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Tracking
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_treatment_plans_client ON treatment_plans(client_id);
CREATE INDEX idx_treatment_plans_created_by ON treatment_plans(created_by);
CREATE INDEX idx_treatment_plans_signed ON treatment_plans(is_signed);
CREATE INDEX idx_treatment_plans_status ON treatment_plans(status);
CREATE INDEX idx_treatment_plans_plan_date ON treatment_plans(plan_date);

CREATE TABLE IF NOT EXISTS treatment_plan_audit_log (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_type VARCHAR(50),
    user_name VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    changes JSONB,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_treatment_plan_audit_log_plan ON treatment_plan_audit_log(plan_id);
CREATE INDEX idx_treatment_plan_audit_log_action ON treatment_plan_audit_log(action);
CREATE INDEX idx_treatment_plan_audit_log_user ON treatment_plan_audit_log(user_id);
CREATE INDEX idx_treatment_plan_audit_log_created ON treatment_plan_audit_log(created_at);

CREATE TRIGGER update_treatment_plans_updated_at BEFORE UPDATE ON treatment_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

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
        error: 'DATABASE_URL not configured',
        message: 'Add DATABASE_URL to Vercel environment variables first',
        instructions: [
          '1. Vercel Dashboard → Your Project → Settings → Environment Variables',
          '2. Add DATABASE_URL with your Crunchy Bridge connection string',
          '3. Redeploy and visit this URL again'
        ]
      });
    }

    const postgres = require('postgres');
    const sql = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 30
    });

    await sql.unsafe(SCHEMA_SQL);

    const tables = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;

    await sql.end();

    return res.status(200).json({
      success: true,
      message: '🎉 Database setup complete!',
      created: {
        tables: tables.length,
        tableNames: tables.map(t => t.tablename)
      },
      nextSteps: [
        '✅ Database is ready!',
        '🔒 Change default admin password (admin/admin123)',
        '🧪 Test at /api/health',
        '🚀 Your app is ready to use'
      ]
    });

  } catch (error) {
    console.error('Setup error:', error);

    if (error.message && error.message.includes('already exists')) {
      return res.status(200).json({
        success: true,
        message: '✅ Database already set up!',
        note: 'Tables already exist. No action needed.'
      });
    }

    return res.status(500).json({
      error: 'Database setup failed',
      message: error.message,
      troubleshooting: [
        'Check DATABASE_URL in Vercel environment variables',
        'Ensure connection string ends with ?sslmode=require',
        'Verify Crunchy Bridge cluster is running (green status)'
      ]
    });
  }
}
