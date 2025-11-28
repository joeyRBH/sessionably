-- Phase 1: Client Management Schema
-- Run: psql -U your_user -d your_db -f sql/migrations/001-client-mgmt.sql

CREATE TABLE clients_v2 (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_email ON clients_v2(email);
CREATE INDEX idx_clients_status ON clients_v2(status);
CREATE INDEX idx_clients_v2_tags ON clients_v2 USING GIN(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON clients_v2 TO sessionably_user;
GRANT USAGE, SELECT ON SEQUENCE clients_v2_id_seq TO sessionably_user;

CREATE INDEX ON clients_v2 USING gin(to_tsvector('english', name || ' ' || COALESCE(notes, '')));
