-- Phase 2: Scheduling Schema
-- Run: psql -U your_user -d your_db -f sql/migrations/002-scheduling.sql

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients_v2(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  appointment_type VARCHAR(50),
  recurring_pattern VARCHAR(50),
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT
);

CREATE INDEX idx_apt_client_id ON appointments(client_id);
CREATE INDEX idx_apt_start_time ON appointments(start_time);
CREATE INDEX idx_apt_status ON appointments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO sessionably_user;
GRANT USAGE, SELECT ON SEQUENCE appointments_id_seq TO sessionably_user;
