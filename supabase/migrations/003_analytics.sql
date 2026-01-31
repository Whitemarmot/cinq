-- CINQ Analytics Events Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- ANALYTICS EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_type_created ON analytics_events(event_type, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access analytics (no user access)
-- No policies = only service role key works

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- ============================================
GRANT ALL ON analytics_events TO service_role;

-- ============================================
-- CLEANUP OLD EVENTS (optional cron job)
-- ============================================
-- Run this periodically to keep the table small:
-- DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days';
