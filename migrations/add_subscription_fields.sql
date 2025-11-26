-- Migration: Add Subscription Fields
-- Date: 2025-11-26
-- Description: Add subscription management fields to support three-tier subscription model

-- =====================================================
-- CREATE CLINICIANS TABLE (if it doesn't exist)
-- =====================================================
-- This table stores clinician/practitioner information
-- If you're using the 'users' table for clinicians, you can apply these fields there instead

CREATE TABLE IF NOT EXISTS clinicians (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Basic Information
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    license_number VARCHAR(100),
    license_type VARCHAR(50),
    npi_number VARCHAR(20),

    -- Practice Information
    practice_name VARCHAR(255),
    practice_address TEXT,
    specialty VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinicians_email ON clinicians(email);
CREATE INDEX IF NOT EXISTS idx_clinicians_user_id ON clinicians(user_id);
CREATE INDEX IF NOT EXISTS idx_clinicians_active ON clinicians(is_active);

-- =====================================================
-- ADD SUBSCRIPTION FIELDS TO CLINICIANS TABLE
-- =====================================================

-- Subscription Plan Information
ALTER TABLE clinicians
ADD COLUMN IF NOT EXISTS subscription_plan_id VARCHAR(50) DEFAULT 'essential',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;

-- Professional Plan Addon Selection
ALTER TABLE clinicians
ADD COLUMN IF NOT EXISTS selected_addon VARCHAR(50),
ADD COLUMN IF NOT EXISTS addon_selected_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS addon_changed_this_cycle BOOLEAN DEFAULT false;

-- Trial Information
ALTER TABLE clinicians
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;

-- Subscription Metadata
ALTER TABLE clinicians
ADD COLUMN IF NOT EXISTS subscription_metadata JSONB;

-- Create indexes for subscription fields
CREATE INDEX IF NOT EXISTS idx_clinicians_subscription ON clinicians(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_clinicians_subscription_status ON clinicians(subscription_status);
CREATE INDEX IF NOT EXISTS idx_clinicians_stripe_customer ON clinicians(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_clinicians_stripe_subscription ON clinicians(stripe_subscription_id);

-- =====================================================
-- ADD SUBSCRIPTION FIELDS TO USERS TABLE (Alternative)
-- =====================================================
-- If you're using the users table for clinicians instead,
-- uncomment the following and comment out the clinicians alterations above:

-- ALTER TABLE users
-- ADD COLUMN IF NOT EXISTS subscription_plan_id VARCHAR(50) DEFAULT 'essential',
-- ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active',
-- ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
-- ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
-- ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
-- ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
-- ADD COLUMN IF NOT EXISTS selected_addon VARCHAR(50),
-- ADD COLUMN IF NOT EXISTS addon_selected_date TIMESTAMP,
-- ADD COLUMN IF NOT EXISTS addon_changed_this_cycle BOOLEAN DEFAULT false,
-- ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
-- ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP,
-- ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
-- ADD COLUMN IF NOT EXISTS subscription_metadata JSONB;

-- CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_plan_id);
-- CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
-- CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
-- CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users(stripe_subscription_id);

-- =====================================================
-- SUBSCRIPTION ADDON HISTORY TABLE
-- =====================================================
-- Track addon changes for Professional plan users

CREATE TABLE IF NOT EXISTS subscription_addon_history (
    id SERIAL PRIMARY KEY,
    clinician_id INTEGER REFERENCES clinicians(id) ON DELETE CASCADE,

    -- Addon details
    addon_id VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'selected', 'changed', 'removed'

    -- Previous addon (for change tracking)
    previous_addon VARCHAR(50),

    -- Change metadata
    changed_by VARCHAR(50) DEFAULT 'user',
    change_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addon_history_clinician ON subscription_addon_history(clinician_id);
CREATE INDEX idx_addon_history_action ON subscription_addon_history(action);
CREATE INDEX idx_addon_history_created ON subscription_addon_history(created_at);

-- =====================================================
-- SUBSCRIPTION EVENTS TABLE
-- =====================================================
-- Track all subscription-related events for auditing

CREATE TABLE IF NOT EXISTS subscription_events (
    id SERIAL PRIMARY KEY,
    clinician_id INTEGER REFERENCES clinicians(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(100) NOT NULL, -- 'plan_upgrade', 'plan_downgrade', 'addon_selected', 'trial_started', 'subscription_canceled', etc.
    event_data JSONB,

    -- Stripe references
    stripe_event_id VARCHAR(255),
    stripe_event_type VARCHAR(100),

    -- Metadata
    user_agent TEXT,
    ip_address VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_events_clinician ON subscription_events(clinician_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX idx_subscription_events_stripe ON subscription_events(stripe_event_id);
CREATE INDEX idx_subscription_events_created ON subscription_events(created_at);

-- =====================================================
-- VIEWS FOR SUBSCRIPTION REPORTING
-- =====================================================

-- Active subscriptions summary
CREATE OR REPLACE VIEW v_subscription_summary AS
SELECT
    subscription_plan_id,
    subscription_status,
    COUNT(*) as subscriber_count,
    COUNT(CASE WHEN selected_addon = 'ai_notes' THEN 1 END) as ai_notes_users,
    COUNT(CASE WHEN selected_addon = 'telehealth' THEN 1 END) as telehealth_users,
    COUNT(CASE WHEN trial_used = true AND subscription_status = 'trial' THEN 1 END) as active_trials
FROM clinicians
GROUP BY subscription_plan_id, subscription_status;

-- Trial conversions
CREATE OR REPLACE VIEW v_trial_conversions AS
SELECT
    DATE_TRUNC('month', trial_start_date) as month,
    COUNT(*) as trials_started,
    COUNT(CASE WHEN subscription_status = 'active' AND subscription_plan_id != 'essential' THEN 1 END) as conversions,
    ROUND(
        100.0 * COUNT(CASE WHEN subscription_status = 'active' AND subscription_plan_id != 'essential' THEN 1 END) /
        NULLIF(COUNT(*), 0),
        2
    ) as conversion_rate
FROM clinicians
WHERE trial_used = true
GROUP BY DATE_TRUNC('month', trial_start_date)
ORDER BY month DESC;

-- Revenue projection (MRR - Monthly Recurring Revenue)
CREATE OR REPLACE VIEW v_monthly_recurring_revenue AS
SELECT
    SUM(CASE
        WHEN subscription_plan_id = 'essential' THEN 40
        WHEN subscription_plan_id = 'professional' THEN 60
        WHEN subscription_plan_id = 'complete' THEN 80
        ELSE 0
    END) as total_mrr,
    SUM(CASE WHEN subscription_plan_id = 'essential' THEN 40 ELSE 0 END) as essential_mrr,
    SUM(CASE WHEN subscription_plan_id = 'professional' THEN 60 ELSE 0 END) as professional_mrr,
    SUM(CASE WHEN subscription_plan_id = 'complete' THEN 80 ELSE 0 END) as complete_mrr
FROM clinicians
WHERE subscription_status = 'active';

-- =====================================================
-- UPDATE EXISTING USERS
-- =====================================================
-- Set default subscription plan for existing users

UPDATE clinicians
SET subscription_plan_id = 'essential',
    subscription_status = 'active',
    subscription_start_date = CURRENT_TIMESTAMP
WHERE subscription_plan_id IS NULL;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to log subscription changes
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log plan changes
    IF OLD.subscription_plan_id IS DISTINCT FROM NEW.subscription_plan_id THEN
        INSERT INTO subscription_events (clinician_id, event_type, event_data)
        VALUES (
            NEW.id,
            CASE
                WHEN NEW.subscription_plan_id = 'complete' THEN 'plan_upgrade'
                WHEN NEW.subscription_plan_id = 'essential' THEN 'plan_downgrade'
                ELSE 'plan_change'
            END,
            jsonb_build_object(
                'old_plan', OLD.subscription_plan_id,
                'new_plan', NEW.subscription_plan_id,
                'timestamp', CURRENT_TIMESTAMP
            )
        );
    END IF;

    -- Log addon changes
    IF OLD.selected_addon IS DISTINCT FROM NEW.selected_addon THEN
        INSERT INTO subscription_addon_history (clinician_id, addon_id, action, previous_addon)
        VALUES (
            NEW.id,
            COALESCE(NEW.selected_addon, 'none'),
            CASE
                WHEN NEW.selected_addon IS NULL THEN 'removed'
                WHEN OLD.selected_addon IS NULL THEN 'selected'
                ELSE 'changed'
            END,
            OLD.selected_addon
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to clinicians table
DROP TRIGGER IF EXISTS trigger_log_subscription_change ON clinicians;
CREATE TRIGGER trigger_log_subscription_change
    AFTER UPDATE ON clinicians
    FOR EACH ROW
    WHEN (
        OLD.subscription_plan_id IS DISTINCT FROM NEW.subscription_plan_id OR
        OLD.selected_addon IS DISTINCT FROM NEW.selected_addon
    )
    EXECUTE FUNCTION log_subscription_change();

-- =====================================================
-- CONSTRAINTS
-- =====================================================

-- Ensure valid subscription plans
ALTER TABLE clinicians
DROP CONSTRAINT IF EXISTS check_valid_subscription_plan;

ALTER TABLE clinicians
ADD CONSTRAINT check_valid_subscription_plan
CHECK (subscription_plan_id IN ('essential', 'professional', 'complete'));

-- Ensure valid subscription status
ALTER TABLE clinicians
DROP CONSTRAINT IF EXISTS check_valid_subscription_status;

ALTER TABLE clinicians
ADD CONSTRAINT check_valid_subscription_status
CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trial', 'paused'));

-- Ensure valid addons
ALTER TABLE clinicians
DROP CONSTRAINT IF EXISTS check_valid_addon;

ALTER TABLE clinicians
ADD CONSTRAINT check_valid_addon
CHECK (selected_addon IN ('ai_notes', 'telehealth', NULL));

-- Professional plan addon logic
ALTER TABLE clinicians
DROP CONSTRAINT IF EXISTS check_professional_addon;

ALTER TABLE clinicians
ADD CONSTRAINT check_professional_addon
CHECK (
    (subscription_plan_id = 'professional' AND selected_addon IS NOT NULL) OR
    (subscription_plan_id != 'professional')
);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Subscription Fields Migration Complete';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Added fields:';
    RAISE NOTICE '  - subscription_plan_id (essential/professional/complete)';
    RAISE NOTICE '  - subscription_status (active/canceled/trial/etc)';
    RAISE NOTICE '  - selected_addon (ai_notes/telehealth)';
    RAISE NOTICE '  - Stripe integration fields';
    RAISE NOTICE '  - Trial management fields';
    RAISE NOTICE '';
    RAISE NOTICE 'New tables:';
    RAISE NOTICE '  - subscription_addon_history';
    RAISE NOTICE '  - subscription_events';
    RAISE NOTICE '';
    RAISE NOTICE 'New views:';
    RAISE NOTICE '  - v_subscription_summary';
    RAISE NOTICE '  - v_trial_conversions';
    RAISE NOTICE '  - v_monthly_recurring_revenue';
    RAISE NOTICE '============================================';
END $$;
