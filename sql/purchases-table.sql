-- ============================================
-- PURCHASES TABLE (Gift Code Packs)
-- ============================================
-- This table tracks Stripe payments for gift code packs

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Stripe information
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT,
    
    -- Customer information
    customer_email TEXT,
    customer_name TEXT,
    
    -- Purchase details
    pack_type TEXT NOT NULL DEFAULT '5_codes' CHECK (pack_type IN ('5_codes', '10_codes', '20_codes')),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 100),
    codes_count INTEGER NOT NULL CHECK (codes_count > 0),
    
    -- Pricing
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD')),
    
    -- Generated codes (for quick access)
    codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_customer_email ON purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- Add purchase_session_id to gift_codes table
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS purchase_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_gift_codes_purchase_session ON gift_codes(purchase_session_id);

-- Update trigger for purchases
CREATE OR REPLACE FUNCTION update_purchases_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-set completed_at when status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS purchases_updated_at ON purchases;
CREATE TRIGGER purchases_updated_at
    BEFORE UPDATE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_purchases_timestamp();

-- ============================================
-- ROW LEVEL SECURITY FOR PURCHASES
-- ============================================
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Only system can create/update purchases (via API keys)
-- No user-level access for security
CREATE POLICY "System can manage purchases" ON purchases
    FOR ALL USING (false); -- Disabled for regular users

-- Admin-only access via service role
-- (The API endpoints use service role key for access)

-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- Purchase summary view
CREATE OR REPLACE VIEW purchase_summary AS
SELECT 
    p.id,
    p.stripe_session_id,
    p.customer_email,
    p.pack_type,
    p.quantity,
    p.codes_count,
    p.amount_cents / 100.0 AS amount_euros,
    p.status,
    p.created_at,
    p.completed_at,
    COUNT(gc.id) as active_codes_count,
    COUNT(gc.id) FILTER (WHERE gc.status = 'redeemed') as redeemed_codes_count
FROM purchases p
LEFT JOIN gift_codes gc ON gc.purchase_session_id = p.stripe_session_id
WHERE p.status = 'completed'
GROUP BY p.id, p.stripe_session_id, p.customer_email, p.pack_type, p.quantity, p.codes_count, p.amount_cents, p.status, p.created_at, p.completed_at
ORDER BY p.created_at DESC;

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================
-- Uncomment for dev/testing environments only

/*
INSERT INTO purchases (
    stripe_session_id,
    customer_email,
    pack_type,
    quantity,
    codes_count,
    amount_cents,
    codes,
    status,
    completed_at
) VALUES (
    'cs_test_sample_session_123',
    'test@example.com',
    '5_codes',
    1,
    5,
    500,
    '["CINQ-TEST-ABC1", "CINQ-TEST-ABC2", "CINQ-TEST-ABC3", "CINQ-TEST-ABC4", "CINQ-TEST-ABC5"]',
    'completed',
    NOW()
) ON CONFLICT (stripe_session_id) DO NOTHING;
*/