-- Sessionably Database Schema
-- PostgreSQL 16/17 compatible
-- For use with Crunchy Bridge or any PostgreSQL provider

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CLIENTS TABLE
-- =====================================================
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

    -- Stripe integration
    stripe_customer_id VARCHAR(255) UNIQUE,
    autopay_enabled BOOLEAN DEFAULT false,

    -- Status and tracking
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    CONSTRAINT clients_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' OR email IS NULL)
);

CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_stripe_customer ON clients(stripe_customer_id);
CREATE INDEX idx_clients_status ON clients(status);

-- =====================================================
-- APPOINTMENTS TABLE
-- =====================================================
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
    completed_at TIMESTAMP,
    modality VARCHAR(50) DEFAULT 'in-person',
    telehealth_room_id VARCHAR(255),
    telehealth_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Amounts
    subtotal DECIMAL(10, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) DEFAULT 0.00,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    payment_date DATE,

    -- Stripe integration
    stripe_payment_intent_id VARCHAR(255),

    -- Autopay
    autopay_attempted BOOLEAN DEFAULT false,
    autopay_result JSONB,

    -- Details
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_payment_intent ON invoices(stripe_payment_intent_id);

-- =====================================================
-- INVOICE LINE ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    cpt_code VARCHAR(10),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);

-- =====================================================
-- PAYMENT METHODS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Stripe reference (NEVER store actual card data)
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,

    -- Display information only
    type VARCHAR(50) DEFAULT 'card',
    last4 VARCHAR(4),
    brand VARCHAR(50),
    expiry_month INTEGER,
    expiry_year INTEGER,

    -- Settings
    is_default BOOLEAN DEFAULT false,
    is_autopay_enabled BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_client ON payment_methods(client_id);
CREATE INDEX idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(client_id, is_default);

-- =====================================================
-- PAYMENT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL,

    -- Transaction details
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,

    -- Stripe references
    stripe_charge_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),

    -- Refund details
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

-- =====================================================
-- DOCUMENTS TABLE
-- =====================================================
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

-- =====================================================
-- ASSIGNED DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS assigned_documents (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,

    -- Access control
    access_code VARCHAR(100) UNIQUE NOT NULL,
    access_code_expires_at TIMESTAMP,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    viewed_at TIMESTAMP,
    signed_at TIMESTAMP,
    signature_data TEXT,

    -- Tracking
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

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================
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

-- =====================================================
-- USERS TABLE (for admin/staff)
-- =====================================================
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

-- =====================================================
-- PRACTICE SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS practice_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Practice Information
    practice_name VARCHAR(255),
    practice_address TEXT,
    practice_phone VARCHAR(50),
    practice_email VARCHAR(255),
    practice_website VARCHAR(255),

    -- Provider Information
    provider_npi VARCHAR(50),
    provider_tax_id VARCHAR(50),
    provider_license VARCHAR(100),

    -- Billing Settings
    default_invoice_terms VARCHAR(50) DEFAULT 'net30',
    tax_enabled BOOLEAN DEFAULT false,
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,

    -- Invoice Customization
    invoice_logo_url TEXT,
    invoice_footer_text TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure only one settings record per user
    UNIQUE(user_id)
);

CREATE INDEX idx_practice_settings_user ON practice_settings(user_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
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

CREATE TRIGGER update_practice_settings_updated_at BEFORE UPDATE ON practice_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (for development/testing)
-- =====================================================

-- Insert demo admin user (password: admin123)
-- Note: In production, use proper password hashing (bcrypt)
INSERT INTO users (username, password_hash, email, full_name, role)
VALUES ('admin', '$2a$10$rK8qU5P8kZQxVZ9z9K7qYOqGZxJ8ZqK4K5q8K7qYOqGZxJ8ZqK4K5', 'admin@sessionably.com', 'System Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert demo document templates
INSERT INTO documents (title, description, document_type, is_template, content)
VALUES
    ('Informed Consent', 'Standard informed consent form for treatment', 'consent', true, 'I hereby consent to treatment...'),
    ('HIPAA Notice', 'Notice of Privacy Practices', 'legal', true, 'Your health information privacy is important...'),
    ('Treatment Agreement', 'Agreement for ongoing treatment', 'agreement', true, 'This agreement outlines the terms of treatment...')
ON CONFLICT DO NOTHING;

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- Active clients with payment status
CREATE OR REPLACE VIEW v_clients_with_payment_status AS
SELECT
    c.*,
    COUNT(DISTINCT i.id) as total_invoices,
    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN i.status IN ('pending', 'overdue') THEN i.total_amount ELSE 0 END) as total_outstanding,
    MAX(i.payment_date) as last_payment_date
FROM clients c
LEFT JOIN invoices i ON c.id = i.client_id
WHERE c.status = 'active'
GROUP BY c.id;

-- Upcoming appointments
CREATE OR REPLACE VIEW v_upcoming_appointments AS
SELECT
    a.*,
    c.name as client_name,
    c.email as client_email,
    c.phone as client_phone
FROM appointments a
JOIN clients c ON a.client_id = c.id
WHERE a.appointment_date >= CURRENT_DATE
    AND a.status = 'scheduled'
ORDER BY a.appointment_date, a.appointment_time;

-- Revenue summary
CREATE OR REPLACE VIEW v_revenue_summary AS
SELECT
    DATE_TRUNC('month', payment_date) as month,
    COUNT(*) as paid_invoices,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_invoice_amount
FROM invoices
WHERE status = 'paid'
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY month DESC;

-- =====================================================
-- GRANTS (adjust based on your user setup)
-- =====================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_database_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_database_user;

-- =====================================================
-- CLIENT USERS TABLE (for client portal authentication)
-- =====================================================
CREATE TABLE IF NOT EXISTS client_users (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Security
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,

    -- Session tracking
    last_login TIMESTAMP,
    last_login_ip VARCHAR(50),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(client_id)
);

CREATE INDEX idx_client_users_email ON client_users(email);
CREATE INDEX idx_client_users_client_id ON client_users(client_id);
CREATE INDEX idx_client_users_verification_token ON client_users(verification_token);
CREATE INDEX idx_client_users_reset_token ON client_users(reset_token);

CREATE TRIGGER update_client_users_updated_at BEFORE UPDATE ON client_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CLIENT NOTIFICATION SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS client_notification_settings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Email preferences
    email_notifications BOOLEAN DEFAULT true,
    email_appointment_reminders BOOLEAN DEFAULT true,
    email_appointment_confirmations BOOLEAN DEFAULT true,
    email_invoice_reminders BOOLEAN DEFAULT true,
    email_payment_receipts BOOLEAN DEFAULT true,
    email_document_updates BOOLEAN DEFAULT true,
    email_marketing BOOLEAN DEFAULT false,

    -- SMS preferences
    sms_notifications BOOLEAN DEFAULT false,
    sms_appointment_reminders BOOLEAN DEFAULT false,
    sms_appointment_confirmations BOOLEAN DEFAULT false,
    sms_invoice_reminders BOOLEAN DEFAULT false,
    sms_payment_receipts BOOLEAN DEFAULT false,

    -- General preferences
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

CREATE INDEX idx_client_notification_settings_client ON client_notification_settings(client_id);

CREATE TRIGGER update_client_notification_settings_updated_at BEFORE UPDATE ON client_notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- NOTIFICATION LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_log (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Notification details
    notification_type VARCHAR(100) NOT NULL,
    notification_category VARCHAR(100),
    subject VARCHAR(255),
    message TEXT,

    -- Delivery details
    delivery_method VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,

    -- Related entities
    related_entity_type VARCHAR(100),
    related_entity_id INTEGER,

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_log_client ON notification_log(client_id);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at);
CREATE INDEX idx_notification_log_related ON notification_log(related_entity_type, related_entity_id);
CREATE INDEX idx_notification_log_created ON notification_log(created_at);

-- =====================================================
-- CLIENT PORTAL MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS client_messages (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Message details
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(50) DEFAULT 'normal',

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    -- Sender info
    sender_type VARCHAR(50),
    sender_id INTEGER,
    sender_name VARCHAR(255),

    -- Related entities
    related_entity_type VARCHAR(100),
    related_entity_id INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_messages_client ON client_messages(client_id);
CREATE INDEX idx_client_messages_type ON client_messages(message_type);
CREATE INDEX idx_client_messages_read ON client_messages(is_read);
CREATE INDEX idx_client_messages_created ON client_messages(created_at);

-- =====================================================
-- CLIENT SESSIONS TABLE (for session management)
-- =====================================================
CREATE TABLE IF NOT EXISTS client_sessions (
    id SERIAL PRIMARY KEY,
    client_user_id INTEGER REFERENCES client_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,

    -- Session details
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_type VARCHAR(50),

    -- Expiration
    expires_at TIMESTAMP NOT NULL,

    -- Tracking
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_sessions_user ON client_sessions(client_user_id);
CREATE INDEX idx_client_sessions_token ON client_sessions(session_token);
CREATE INDEX idx_client_sessions_expires ON client_sessions(expires_at);
CREATE INDEX idx_client_sessions_active ON client_sessions(is_active);

-- =====================================================
-- INSURANCE CLAIMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_claims (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Claim identification
    claim_number VARCHAR(100) UNIQUE NOT NULL,
    member_id VARCHAR(100) NOT NULL,
    payer_id VARCHAR(100) NOT NULL,
    payer_name VARCHAR(255),

    -- Service details
    service_date DATE NOT NULL,
    cpt_code VARCHAR(10) NOT NULL,
    diagnosis_code VARCHAR(20) NOT NULL,
    place_of_service VARCHAR(10) DEFAULT '11',

    -- Financial details
    amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2),
    adjustment_amount DECIMAL(10, 2),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending',
    denial_reason TEXT,

    -- Provider information
    provider_npi VARCHAR(20),
    provider_taxonomy VARCHAR(20),

    -- Submission tracking
    submitted_at TIMESTAMP,
    processed_at TIMESTAMP,

    -- Availity integration
    availity_claim_id VARCHAR(255),
    availity_response JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insurance_claims_client ON insurance_claims(client_id);
CREATE INDEX idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX idx_insurance_claims_claim_number ON insurance_claims(claim_number);
CREATE INDEX idx_insurance_claims_service_date ON insurance_claims(service_date);
CREATE INDEX idx_insurance_claims_payer ON insurance_claims(payer_id);

CREATE TRIGGER update_insurance_claims_updated_at BEFORE UPDATE ON insurance_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSURANCE VERIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_verifications (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Insurance details
    member_id VARCHAR(100) NOT NULL,
    payer_id VARCHAR(100) NOT NULL,
    payer_name VARCHAR(255),
    service_type VARCHAR(50),

    -- Eligibility status
    status VARCHAR(50) DEFAULT 'active',

    -- Benefits information
    deductible VARCHAR(100),
    deductible_met VARCHAR(100),
    copay VARCHAR(100),
    coinsurance VARCHAR(100),
    out_of_pocket_max VARCHAR(100),

    -- Coverage dates
    coverage_start DATE,
    coverage_end DATE,

    -- Additional details
    group_number VARCHAR(100),
    plan_name VARCHAR(255),
    plan_type VARCHAR(100),

    -- Response data
    response_data JSONB,

    -- Availity integration
    availity_response JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insurance_verifications_client ON insurance_verifications(client_id);
CREATE INDEX idx_insurance_verifications_payer ON insurance_verifications(payer_id);
CREATE INDEX idx_insurance_verifications_created ON insurance_verifications(created_at);

-- =====================================================
-- INSURANCE SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS insurance_settings (
    id SERIAL PRIMARY KEY,

    -- Availity API credentials
    availity_client_id VARCHAR(255),
    availity_client_secret VARCHAR(255),
    availity_test_mode BOOLEAN DEFAULT true,

    -- Default claim settings
    default_place_of_service VARCHAR(10) DEFAULT '11',
    default_billing_provider VARCHAR(20),
    default_taxonomy VARCHAR(20),

    -- Provider information
    provider_npi VARCHAR(20),
    provider_tax_id VARCHAR(20),
    provider_name VARCHAR(255),
    provider_address TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_insurance_settings_updated_at BEFORE UPDATE ON insurance_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSURANCE VIEWS
-- =====================================================

-- Claims summary by status
CREATE OR REPLACE VIEW v_claims_summary AS
SELECT
    status,
    COUNT(*) as claim_count,
    SUM(amount) as total_claimed,
    SUM(paid_amount) as total_paid,
    AVG(amount) as avg_claim_amount
FROM insurance_claims
GROUP BY status;

-- Recent verifications
CREATE OR REPLACE VIEW v_recent_verifications AS
SELECT
    iv.*,
    c.name as client_name,
    c.email as client_email
FROM insurance_verifications iv
JOIN clients c ON iv.client_id = c.id
ORDER BY iv.created_at DESC
LIMIT 100;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Sessionably Database Schema Created';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tables: clients, appointments, invoices, payment_methods, payment_transactions, documents, assigned_documents, audit_log, users';
    RAISE NOTICE 'Client Portal Tables: client_users, client_notification_settings, notification_log, client_messages, client_sessions';
    RAISE NOTICE 'Insurance Tables: insurance_claims, insurance_verifications, insurance_settings';
    RAISE NOTICE 'Views: v_clients_with_payment_status, v_upcoming_appointments, v_revenue_summary, v_claims_summary, v_recent_verifications';
    RAISE NOTICE 'Ready for Crunchy Bridge PostgreSQL 16/17';
    RAISE NOTICE '============================================';
END $$;
