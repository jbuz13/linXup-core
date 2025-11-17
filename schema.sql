-- LinXup Database Schema
-- PostgreSQL 17.6
-- Created: 2024-11-17

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- Stores user account information
-- ============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    plan_tier VARCHAR(50) DEFAULT 'free' CHECK (plan_tier IN ('free', 'basic', 'pro', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan_tier ON users(plan_tier);

-- ============================================================================
-- WEBSITES TABLE
-- Stores websites that are being monitored
-- ============================================================================
CREATE TABLE websites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    scan_frequency VARCHAR(20) DEFAULT 'weekly' CHECK (scan_frequency IN ('manual', 'daily', 'weekly', 'monthly')),
    scan_day_of_week INTEGER CHECK (scan_day_of_week BETWEEN 0 AND 6),
    scan_hour INTEGER DEFAULT 9 CHECK (scan_hour BETWEEN 0 AND 23),
    last_scanned_at TIMESTAMP,
    next_scan_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_websites_user_id ON websites(user_id);
CREATE INDEX idx_websites_url ON websites(url);
CREATE INDEX idx_websites_next_scan_at ON websites(next_scan_at);
CREATE INDEX idx_websites_is_active ON websites(is_active);

-- ============================================================================
-- SCAN_RESULTS TABLE
-- Stores results of each website scan
-- ============================================================================
CREATE TABLE scan_results (
    id SERIAL PRIMARY KEY,
    website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) DEFAULT 'scheduled' CHECK (scan_type IN ('scheduled', 'manual')),
    triggered_by INTEGER REFERENCES users(id),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_links INTEGER DEFAULT 0,
    broken_links INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    health_score INTEGER CHECK (health_score BETWEEN 0 AND 100),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scan_results_website_id ON scan_results(website_id);
CREATE INDEX idx_scan_results_status ON scan_results(status);
CREATE INDEX idx_scan_results_started_at ON scan_results(started_at);
CREATE INDEX idx_scan_results_scan_type ON scan_results(scan_type);

-- ============================================================================
-- BROKEN_LINKS TABLE
-- Stores individual broken links found during scans
-- ============================================================================
CREATE TABLE broken_links (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    status_code INTEGER,
    found_on VARCHAR(2048) NOT NULL,
    link_text TEXT,
    html_context TEXT,
    ai_analysis JSONB,
    suggested_fixes JSONB,
    priority_score INTEGER CHECK (priority_score BETWEEN 0 AND 100),
    is_critical BOOLEAN DEFAULT false,
    first_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_broken_links_scan_id ON broken_links(scan_id);
CREATE INDEX idx_broken_links_url ON broken_links(url);
CREATE INDEX idx_broken_links_status_code ON broken_links(status_code);
CREATE INDEX idx_broken_links_priority_score ON broken_links(priority_score);
CREATE INDEX idx_broken_links_is_critical ON broken_links(is_critical);
CREATE INDEX idx_broken_links_ai_analysis ON broken_links USING GIN(ai_analysis);

-- ============================================================================
-- ALERT_PREFERENCES TABLE
-- Stores user preferences for email alerts
-- ============================================================================
CREATE TABLE alert_preferences (
    id SERIAL PRIMARY KEY,
    website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    alert_on_new_broken BOOLEAN DEFAULT true,
    alert_on_fixed BOOLEAN DEFAULT true,
    alert_weekly_summary BOOLEAN DEFAULT false,
    alert_critical_only BOOLEAN DEFAULT false,
    digest_mode BOOLEAN DEFAULT false,
    email_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(website_id)
);

CREATE INDEX idx_alert_preferences_website_id ON alert_preferences(website_id);

-- ============================================================================
-- LINK_HISTORY TABLE (Optional - for tracking link status over time)
-- Tracks the history of links to detect when they break/fix
-- ============================================================================
CREATE TABLE link_history (
    id SERIAL PRIMARY KEY,
    website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    status_code INTEGER,
    is_broken BOOLEAN DEFAULT false,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scan_id INTEGER REFERENCES scan_results(id)
);

CREATE INDEX idx_link_history_website_id ON link_history(website_id);
CREATE INDEX idx_link_history_url ON link_history(url);
CREATE INDEX idx_link_history_checked_at ON link_history(checked_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON websites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_preferences_updated_at BEFORE UPDATE ON alert_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (for testing)
-- ============================================================================
-- Insert a test user
INSERT INTO users (email, name, organization, plan_tier) VALUES
('pilot@alaskaimpactalliance.org', 'Alaska Impact Alliance', 'Alaska Impact Alliance', 'free');

-- Insert a test website
INSERT INTO websites (user_id, name, url, scan_frequency, scan_day_of_week, scan_hour) VALUES
(1, 'Alaska Impact Alliance Main Site', 'https://alaskaimpactalliance.org', 'weekly', 1, 9);

-- Insert default alert preferences
INSERT INTO alert_preferences (website_id, email_recipients) VALUES
(1, ARRAY['pilot@alaskaimpactalliance.org']);

-- ============================================================================
-- VIEWS (for easier querying)
-- ============================================================================

-- View: Latest scan results for each website
CREATE VIEW latest_scans AS
SELECT DISTINCT ON (website_id)
    sr.*,
    w.name AS website_name,
    w.url AS website_url
FROM scan_results sr
JOIN websites w ON w.id = sr.website_id
ORDER BY website_id, started_at DESC;

-- View: Currently broken links across all sites
CREATE VIEW current_broken_links AS
SELECT
    bl.*,
    sr.website_id,
    w.name AS website_name,
    w.url AS website_url,
    u.email AS user_email
FROM broken_links bl
JOIN scan_results sr ON sr.id = bl.scan_id
JOIN websites w ON w.id = sr.website_id
JOIN users u ON u.id = w.user_id
WHERE sr.id IN (
    SELECT id FROM latest_scans
    WHERE status = 'completed'
);

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================
COMMENT ON TABLE users IS 'User accounts for LinXup SaaS';
COMMENT ON TABLE websites IS 'Websites being monitored for broken links';
COMMENT ON TABLE scan_results IS 'Results of website scans';
COMMENT ON TABLE broken_links IS 'Individual broken links found during scans with AI analysis';
COMMENT ON TABLE alert_preferences IS 'Email notification preferences per website';
COMMENT ON TABLE link_history IS 'Historical tracking of link status changes';

COMMENT ON COLUMN broken_links.ai_analysis IS 'JSONB field containing GPT-4 analysis: {intendedDestination, linkPurpose, importance, reasoning}';
COMMENT ON COLUMN broken_links.suggested_fixes IS 'JSONB array of suggested replacement URLs from AI + Wayback Machine';
COMMENT ON COLUMN broken_links.priority_score IS 'AI-calculated priority score (0-100) based on business impact';
