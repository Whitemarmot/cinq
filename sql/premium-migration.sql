-- ============================================
-- CINQ Premium "5²" - Database Migration
-- ============================================
-- Run this in Supabase SQL Editor
-- Version: 1.0.0
-- Date: 2025-02-01
-- ============================================

-- ============================================
-- 1. SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'inactive' 
        CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired')),
    
    -- Plan info
    plan_id TEXT NOT NULL DEFAULT 'free'
        CHECK (plan_id IN ('free', '5squared_monthly', '5squared_annual')),
    
    -- Provider info (pour la réconciliation)
    provider TEXT NOT NULL DEFAULT 'none'
        CHECK (provider IN ('none', 'stripe', 'revenuecat', 'btcpay', 'apple', 'google')),
    provider_subscription_id TEXT,
    provider_customer_id TEXT,
    
    -- Dates
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un seul abonnement par user
    UNIQUE(user_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(status) WHERE status IN ('trialing', 'active');

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "Users can view own subscription" ON subscriptions 
    FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies = service role only
COMMENT ON TABLE subscriptions IS 'Premium subscriptions for 5² tier. Managed by webhooks only.';

-- ============================================
-- 2. SUBSCRIPTION EVENTS TABLE (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL
        CHECK (event_type IN (
            'trial_started', 'trial_ended', 'trial_converted',
            'subscription_created', 'subscription_renewed', 
            'subscription_canceled', 'subscription_expired',
            'payment_succeeded', 'payment_failed',
            'plan_changed', 'refunded'
        )),
    
    -- Event data
    previous_status TEXT,
    new_status TEXT,
    provider TEXT,
    provider_event_id TEXT,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'EUR',
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sub_events_created ON subscription_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_events_provider ON subscription_events(provider, provider_event_id);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view own subscription events" ON subscription_events 
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE subscription_events IS 'Audit log for all subscription changes. Immutable.';

-- ============================================
-- 3. UPDATE USERS TABLE
-- ============================================

-- Add premium-related columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_limit INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Ensure defaults for existing users
UPDATE users SET contact_limit = 5 WHERE contact_limit IS NULL;
UPDATE users SET is_premium = FALSE WHERE is_premium IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_premium ON users(is_premium) WHERE is_premium = TRUE;

-- ============================================
-- 4. TRIGGER: Sync subscription status to users
-- ============================================
CREATE OR REPLACE FUNCTION update_user_premium_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET 
        is_premium = (NEW.status IN ('trialing', 'active')),
        contact_limit = CASE 
            WHEN NEW.status IN ('trialing', 'active') THEN 25 
            ELSE 5 
        END,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_change ON subscriptions;
CREATE TRIGGER on_subscription_change
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_user_premium_status();

-- ============================================
-- 5. UPDATE CONTACT LIMIT TRIGGER
-- ============================================

-- Replace existing trigger to use dynamic contact_limit
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Get user's contact limit (default 5 for free, 25 for premium)
    SELECT COALESCE(contact_limit, 5) INTO user_limit 
    FROM users WHERE id = NEW.user_id;
    
    -- Count non-archived contacts
    SELECT COUNT(*) INTO current_count 
    FROM contacts 
    WHERE user_id = NEW.user_id 
    AND (archived IS NULL OR archived = FALSE);
    
    IF current_count >= user_limit THEN
        RAISE EXCEPTION 'Maximum % contacts allowed. Upgrade to 5² for 25 contacts!', user_limit;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, function is replaced

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Check if user is premium
CREATE OR REPLACE FUNCTION is_user_premium(target_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    check_user_id UUID;
    result BOOLEAN;
BEGIN
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    SELECT EXISTS(
        SELECT 1 FROM subscriptions 
        WHERE user_id = check_user_id 
        AND status IN ('trialing', 'active')
        AND (current_period_end IS NULL OR current_period_end > NOW())
    ) INTO result;
    
    RETURN COALESCE(result, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_user_premium IS 'Returns true if user has active premium subscription';

-- Get subscription info
CREATE OR REPLACE FUNCTION get_subscription_info(target_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    check_user_id UUID;
    sub_record RECORD;
BEGIN
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    SELECT * INTO sub_record FROM subscriptions 
    WHERE user_id = check_user_id;
    
    IF sub_record IS NULL THEN
        RETURN jsonb_build_object(
            'plan', 'free',
            'status', 'inactive',
            'contact_limit', 5,
            'is_premium', false,
            'trial_end', null,
            'current_period_end', null,
            'canceled_at', null
        );
    END IF;
    
    RETURN jsonb_build_object(
        'plan', sub_record.plan_id,
        'status', sub_record.status,
        'contact_limit', CASE WHEN sub_record.status IN ('trialing', 'active') THEN 25 ELSE 5 END,
        'is_premium', sub_record.status IN ('trialing', 'active'),
        'trial_end', sub_record.trial_end,
        'current_period_end', sub_record.current_period_end,
        'canceled_at', sub_record.canceled_at,
        'provider', sub_record.provider
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_subscription_info IS 'Returns full subscription details for a user';

-- Get contact usage
CREATE OR REPLACE FUNCTION get_contact_usage(target_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    check_user_id UUID;
    user_limit INTEGER;
    current_count INTEGER;
BEGIN
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    SELECT COALESCE(contact_limit, 5) INTO user_limit 
    FROM users WHERE id = check_user_id;
    
    SELECT COUNT(*) INTO current_count 
    FROM contacts 
    WHERE user_id = check_user_id 
    AND (archived IS NULL OR archived = FALSE);
    
    RETURN jsonb_build_object(
        'used', current_count,
        'limit', user_limit,
        'remaining', user_limit - current_count,
        'can_add', current_count < user_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_contact_usage IS 'Returns contact slot usage for a user';

-- ============================================
-- 7. ADMIN FUNCTIONS (service role only)
-- ============================================

-- Create or update subscription (for webhooks)
CREATE OR REPLACE FUNCTION upsert_subscription(
    p_user_id UUID,
    p_status TEXT,
    p_plan_id TEXT,
    p_provider TEXT,
    p_provider_subscription_id TEXT DEFAULT NULL,
    p_provider_customer_id TEXT DEFAULT NULL,
    p_trial_start TIMESTAMPTZ DEFAULT NULL,
    p_trial_end TIMESTAMPTZ DEFAULT NULL,
    p_current_period_start TIMESTAMPTZ DEFAULT NULL,
    p_current_period_end TIMESTAMPTZ DEFAULT NULL,
    p_canceled_at TIMESTAMPTZ DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    sub_id UUID;
BEGIN
    INSERT INTO subscriptions (
        user_id, status, plan_id, provider, 
        provider_subscription_id, provider_customer_id,
        trial_start, trial_end, 
        current_period_start, current_period_end,
        canceled_at, metadata, updated_at
    ) VALUES (
        p_user_id, p_status, p_plan_id, p_provider,
        p_provider_subscription_id, p_provider_customer_id,
        p_trial_start, p_trial_end,
        p_current_period_start, p_current_period_end,
        p_canceled_at, p_metadata, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        status = EXCLUDED.status,
        plan_id = EXCLUDED.plan_id,
        provider = EXCLUDED.provider,
        provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, subscriptions.provider_subscription_id),
        provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, subscriptions.provider_customer_id),
        trial_start = COALESCE(EXCLUDED.trial_start, subscriptions.trial_start),
        trial_end = COALESCE(EXCLUDED.trial_end, subscriptions.trial_end),
        current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
        current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
        canceled_at = EXCLUDED.canceled_at,
        metadata = subscriptions.metadata || EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO sub_id;
    
    RETURN sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log subscription event
CREATE OR REPLACE FUNCTION log_subscription_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_previous_status TEXT DEFAULT NULL,
    p_new_status TEXT DEFAULT NULL,
    p_provider TEXT DEFAULT NULL,
    p_provider_event_id TEXT DEFAULT NULL,
    p_amount_cents INTEGER DEFAULT NULL,
    p_currency TEXT DEFAULT 'EUR',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    sub_id UUID;
    event_id UUID;
BEGIN
    SELECT id INTO sub_id FROM subscriptions WHERE user_id = p_user_id;
    
    INSERT INTO subscription_events (
        subscription_id, user_id, event_type,
        previous_status, new_status, provider,
        provider_event_id, amount_cents, currency, metadata
    ) VALUES (
        sub_id, p_user_id, p_event_type,
        p_previous_status, p_new_status, p_provider,
        p_provider_event_id, p_amount_cents, p_currency, p_metadata
    )
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. SCHEDULED JOBS (for cron)
-- ============================================

-- Function to expire ended subscriptions (run daily via pg_cron or external cron)
CREATE OR REPLACE FUNCTION expire_ended_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE status IN ('active', 'canceled')
        AND current_period_end < NOW()
        RETURNING user_id
    )
    SELECT COUNT(*) INTO affected_count FROM expired;
    
    -- Log each expiration
    INSERT INTO subscription_events (user_id, event_type, previous_status, new_status, metadata)
    SELECT 
        s.user_id, 
        'subscription_expired',
        s.status,
        'expired',
        jsonb_build_object('auto_expired', true, 'expired_at', NOW())
    FROM subscriptions s
    WHERE s.status = 'expired'
    AND s.updated_at > NOW() - INTERVAL '1 minute';
    
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expire_ended_subscriptions IS 'Run daily to expire subscriptions past their period end';

-- ============================================
-- 9. VIEWS (for analytics)
-- ============================================

CREATE OR REPLACE VIEW subscription_stats AS
SELECT 
    status,
    plan_id,
    provider,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_last_30d,
    COUNT(*) FILTER (WHERE canceled_at > NOW() - INTERVAL '30 days') as canceled_last_30d
FROM subscriptions
GROUP BY status, plan_id, provider;

-- Note: This view is only accessible to service role (no RLS policy)

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

-- Service role gets full access
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON subscription_events TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Authenticated users can only SELECT their own (via RLS)
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON subscription_events TO authenticated;

-- Functions accessible to authenticated users
GRANT EXECUTE ON FUNCTION is_user_premium TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_info TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_usage TO authenticated;

-- Admin functions only for service role
GRANT EXECUTE ON FUNCTION upsert_subscription TO service_role;
GRANT EXECUTE ON FUNCTION log_subscription_event TO service_role;
GRANT EXECUTE ON FUNCTION expire_ended_subscriptions TO service_role;

-- ============================================
-- DONE!
-- ============================================
-- Next steps:
-- 1. Set up Stripe products and prices
-- 2. Configure RevenueCat entitlements
-- 3. Deploy webhook handlers
-- 4. Test the full flow in sandbox mode
-- ============================================
