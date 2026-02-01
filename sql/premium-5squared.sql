-- ============================================
-- PREMIUM 5² — One-Time Payment System
-- 5 contacts gratuits → 25 contacts avec 5² (4.99€ à vie)
-- ============================================

-- 1. Ajouter is_premium à la table users
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_premium') THEN
        ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='premium_since') THEN
        ALTER TABLE users ADD COLUMN premium_since TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_premium ON users(is_premium) WHERE is_premium = TRUE;

-- 2. Table purchases pour tracer les achats
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Produit
    product_id TEXT NOT NULL DEFAULT '5squared',
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    
    -- Provider info
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'btcpay', 'manual')),
    provider_payment_id TEXT,
    provider_customer_id TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_provider ON purchases(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at DESC);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases" ON purchases 
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert/update (API-only)

-- 3. Mettre à jour la fonction de vérification des contacts
-- pour utiliser la limite dynamique (5 gratuit, 25 premium)
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_is_premium BOOLEAN;
    contact_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Vérifier si l'utilisateur est premium
    SELECT COALESCE(is_premium, FALSE) INTO user_is_premium 
    FROM users WHERE id = NEW.user_id;
    
    -- Limite : 25 si premium, 5 sinon
    IF user_is_premium THEN
        contact_limit := 25;
    ELSE
        contact_limit := 5;
    END IF;
    
    -- Compter les contacts non-archivés
    SELECT COUNT(*) INTO current_count 
    FROM contacts 
    WHERE user_id = NEW.user_id 
    AND (archived IS NULL OR archived = FALSE);
    
    IF current_count >= contact_limit THEN
        IF user_is_premium THEN
            RAISE EXCEPTION 'Maximum 25 contacts allowed (5² Premium)';
        ELSE
            RAISE EXCEPTION 'Maximum 5 contacts allowed (upgrade to 5² for 25)';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Fonction pour activer le premium après paiement
CREATE OR REPLACE FUNCTION activate_premium(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET 
        is_premium = TRUE,
        premium_since = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction RPC pour vérifier le statut premium (côté client)
CREATE OR REPLACE FUNCTION get_premium_status(target_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    check_user_id UUID;
    user_record RECORD;
    contact_count INTEGER;
BEGIN
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    SELECT is_premium, premium_since INTO user_record 
    FROM users WHERE id = check_user_id;
    
    SELECT COUNT(*) INTO contact_count 
    FROM contacts 
    WHERE user_id = check_user_id 
    AND (archived IS NULL OR archived = FALSE);
    
    RETURN jsonb_build_object(
        'is_premium', COALESCE(user_record.is_premium, FALSE),
        'premium_since', user_record.premium_since,
        'contact_limit', CASE WHEN COALESCE(user_record.is_premium, FALSE) THEN 25 ELSE 5 END,
        'contact_count', contact_count,
        'slots_remaining', CASE 
            WHEN COALESCE(user_record.is_premium, FALSE) THEN 25 - contact_count 
            ELSE 5 - contact_count 
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fonction pour obtenir l'historique des achats
CREATE OR REPLACE FUNCTION get_purchase_history()
RETURNS TABLE (
    id UUID,
    product_id TEXT,
    amount_cents INTEGER,
    currency TEXT,
    provider TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.product_id,
        p.amount_cents,
        p.currency,
        p.provider,
        p.status,
        p.created_at,
        p.completed_at
    FROM purchases p
    WHERE p.user_id = auth.uid()
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION get_premium_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_purchase_history TO authenticated;
GRANT EXECUTE ON FUNCTION activate_premium TO service_role;
