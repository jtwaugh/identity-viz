-- Demo Data Seed File for AnyBank Identity Platform
-- This file is executed automatically on first database initialization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SCHEMA CREATION
-- =============================================================================

-- Users Table: Stores the identity (authentication concern only)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create enum types
DO $$ BEGIN
    CREATE TYPE tenant_type AS ENUM ('CONSUMER', 'SMALL_BUSINESS', 'COMMERCIAL', 'INVESTMENT', 'TRUST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE membership_role AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE membership_status AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('CHECKING', 'SAVINGS', 'MONEY_MARKET', 'CD', 'LOAN', 'CREDIT_LINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_outcome AS ENUM ('SUCCESS', 'DENIED', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenants Table: Stores organizations/accounts (the contexts)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type tenant_type NOT NULL,
    status tenant_status DEFAULT 'ACTIVE',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Memberships Table: Links users to tenants with roles
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role membership_role NOT NULL,
    status membership_status DEFAULT 'ACTIVE',
    invited_at TIMESTAMP,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Accounts Table: Stores actual financial accounts within tenants
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type account_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    status account_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log Table: Tracks all actions for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    outcome audit_outcome NOT NULL,
    risk_score INTEGER,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================================================
-- DEMO DATA INSERTION
-- =============================================================================

-- Insert Demo Users
INSERT INTO users (id, external_id, email, display_name, mfa_enabled, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'keycloak-sub-jdoe', 'jdoe@example.com', 'John Doe', false, NOW()),
    ('00000000-0000-0000-0000-000000000002', 'keycloak-sub-jsmith', 'jsmith@example.com', 'Jane Smith', false, NOW()),
    ('00000000-0000-0000-0000-000000000003', 'keycloak-sub-admin', 'admin@anybank.com', 'Admin User', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert Demo Tenants
INSERT INTO tenants (id, external_id, name, type, status, metadata, created_at) VALUES
    ('10000000-0000-0000-0000-000000000001', 'tenant-personal-jdoe', 'John Doe', 'CONSUMER', 'ACTIVE', '{"description": "Personal banking account for John Doe"}', NOW()),
    ('10000000-0000-0000-0000-000000000002', 'tenant-personal-jsmith', 'Jane Smith', 'CONSUMER', 'ACTIVE', '{"description": "Personal banking account for Jane Smith"}', NOW()),
    ('10000000-0000-0000-0000-000000000003', 'tenant-business-anybiz', 'AnyBusiness Inc.', 'COMMERCIAL', 'ACTIVE', '{"description": "Commercial banking account for AnyBusiness Inc.", "ein": "12-3456789"}', NOW())
ON CONFLICT (external_id) DO NOTHING;

-- Insert Demo Memberships
INSERT INTO memberships (id, user_id, tenant_id, role, status, accepted_at, created_at) VALUES
    -- John Doe memberships
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'OWNER', 'ACTIVE', NOW(), NOW()),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'OWNER', 'ACTIVE', NOW(), NOW()),
    -- Jane Smith membership
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'OWNER', 'ACTIVE', NOW(), NOW()),
    -- Admin User memberships (has ADMIN role in all tenants)
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'ADMIN', 'ACTIVE', NOW(), NOW()),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'ADMIN', 'ACTIVE', NOW(), NOW()),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'ADMIN', 'ACTIVE', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Insert Demo Accounts
INSERT INTO accounts (id, tenant_id, account_number, account_type, name, balance, currency, status, created_at) VALUES
    -- John Doe Personal Accounts
    (uuid_generate_v4(), '10000000-0000-0000-0000-000000000001', '****1234', 'CHECKING', 'Personal Checking', 4521.33, 'USD', 'ACTIVE', NOW()),
    (uuid_generate_v4(), '10000000-0000-0000-0000-000000000001', '****5678', 'SAVINGS', 'Savings', 12340.00, 'USD', 'ACTIVE', NOW()),
    -- Jane Smith Personal Account
    (uuid_generate_v4(), '10000000-0000-0000-0000-000000000002', '****9012', 'CHECKING', 'Personal Checking', 8765.50, 'USD', 'ACTIVE', NOW()),
    -- AnyBusiness Inc. Commercial Accounts
    (uuid_generate_v4(), '10000000-0000-0000-0000-000000000003', '****4521', 'CHECKING', 'Business Operating', 5400000.00, 'USD', 'ACTIVE', NOW()),
    (uuid_generate_v4(), '10000000-0000-0000-0000-000000000003', '****7832', 'CHECKING', 'Payroll', 234500.00, 'USD', 'ACTIVE', NOW()),
    (uuid_generate_v4(), '10000000-0000-0000-0000-000000000003', '****1199', 'MONEY_MARKET', 'Business Reserve', 1250000.00, 'USD', 'ACTIVE', NOW())
ON CONFLICT (account_number) DO NOTHING;

-- Insert sample audit log entries (for demonstration)
INSERT INTO audit_logs (user_id, tenant_id, action, resource_type, resource_id, outcome, risk_score, metadata, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'LOGIN', 'USER', '00000000-0000-0000-0000-000000000001', 'SUCCESS', 10, '{"ip": "192.168.1.100"}', NOW() - INTERVAL '1 hour'),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'VIEW_BALANCE', 'ACCOUNT', (SELECT id FROM accounts WHERE account_number = '****1234'), 'SUCCESS', 5, '{}', NOW() - INTERVAL '30 minutes'),
    ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'LOGIN', 'USER', '00000000-0000-0000-0000-000000000002', 'SUCCESS', 8, '{"ip": "192.168.1.101"}', NOW() - INTERVAL '2 hours');

-- =============================================================================
-- VERIFICATION QUERIES (commented out - uncomment for manual verification)
-- =============================================================================

-- SELECT 'USERS' as table_name, COUNT(*) as record_count FROM users
-- UNION ALL
-- SELECT 'TENANTS', COUNT(*) FROM tenants
-- UNION ALL
-- SELECT 'MEMBERSHIPS', COUNT(*) FROM memberships
-- UNION ALL
-- SELECT 'ACCOUNTS', COUNT(*) FROM accounts
-- UNION ALL
-- SELECT 'AUDIT_LOGS', COUNT(*) FROM audit_logs;

-- Show user-tenant relationships
-- SELECT
--     u.email,
--     u.display_name,
--     t.name as tenant_name,
--     t.type as tenant_type,
--     m.role
-- FROM memberships m
-- JOIN users u ON m.user_id = u.id
-- JOIN tenants t ON m.tenant_id = t.id
-- ORDER BY u.email, t.type;
