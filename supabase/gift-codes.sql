-- ============================================
-- CINQ Gift Codes System - Supabase Schema
-- SARAH Backend - Secure Gift Code Management
-- ============================================

-- Table principale des codes cadeaux
CREATE TABLE IF NOT EXISTS gift_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Code unique format CINQ-XXXX-XXXX-XXXX (hashé pour sécurité)
    code_hash TEXT NOT NULL UNIQUE,
    
    -- Métadonnées du code
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP')),
    
    -- Statut du code
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
    
    -- Informations acheteur
    purchaser_email TEXT,
    purchaser_name TEXT,
    purchase_order_id TEXT, -- Référence Stripe/paiement
    
    -- Informations destinataire (optionnel)
    recipient_email TEXT,
    recipient_name TEXT,
    gift_message TEXT,
    
    -- Utilisation
    redeemed_by UUID REFERENCES auth.users(id),
    redeemed_at TIMESTAMPTZ,
    redeemed_order_id TEXT, -- Commande où le code a été utilisé
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Anti-fraude: préfixe visible pour support (4 premiers chars après CINQ-)
    code_prefix TEXT NOT NULL
);

-- Index pour recherche rapide par hash
CREATE INDEX idx_gift_codes_hash ON gift_codes(code_hash);
CREATE INDEX idx_gift_codes_status ON gift_codes(status);
CREATE INDEX idx_gift_codes_prefix ON gift_codes(code_prefix);
CREATE INDEX idx_gift_codes_expires ON gift_codes(expires_at) WHERE status = 'active';

-- ============================================
-- Protection Anti-Bruteforce
-- ============================================

CREATE TABLE IF NOT EXISTS gift_code_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification de la tentative
    ip_address INET NOT NULL,
    user_agent TEXT,
    
    -- Code tenté (hashé)
    attempted_code_hash TEXT NOT NULL,
    
    -- Résultat
    success BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason TEXT,
    
    -- Timestamp
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour rate limiting
CREATE INDEX idx_attempts_ip_time ON gift_code_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_attempts_cleanup ON gift_code_attempts(attempted_at);

-- ============================================
-- Rate Limiting State
-- ============================================

CREATE TABLE IF NOT EXISTS gift_code_rate_limits (
    ip_address INET PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked_until TIMESTAMPTZ
);

-- ============================================
-- Functions
-- ============================================

-- Fonction pour vérifier le rate limit
CREATE OR REPLACE FUNCTION check_gift_code_rate_limit(client_ip INET)
RETURNS TABLE(allowed BOOLEAN, wait_seconds INTEGER, attempts_remaining INTEGER) AS $$
DECLARE
    max_attempts INTEGER := 5;  -- Max tentatives par fenêtre
    window_minutes INTEGER := 15;  -- Fenêtre de temps
    block_minutes INTEGER := 60;  -- Durée du blocage
    current_record RECORD;
BEGIN
    -- Récupérer ou créer l'enregistrement
    SELECT * INTO current_record FROM gift_code_rate_limits WHERE gift_code_rate_limits.ip_address = client_ip;
    
    IF NOT FOUND THEN
        -- Première tentative
        INSERT INTO gift_code_rate_limits (ip_address) VALUES (client_ip);
        RETURN QUERY SELECT TRUE, 0, max_attempts - 1;
        RETURN;
    END IF;
    
    -- Vérifier si bloqué
    IF current_record.blocked_until IS NOT NULL AND current_record.blocked_until > NOW() THEN
        RETURN QUERY SELECT FALSE, 
            EXTRACT(EPOCH FROM (current_record.blocked_until - NOW()))::INTEGER,
            0;
        RETURN;
    END IF;
    
    -- Réinitialiser si fenêtre expirée
    IF current_record.first_attempt_at < NOW() - (window_minutes || ' minutes')::INTERVAL THEN
        UPDATE gift_code_rate_limits 
        SET attempt_count = 1, 
            first_attempt_at = NOW(), 
            last_attempt_at = NOW(),
            blocked_until = NULL
        WHERE gift_code_rate_limits.ip_address = client_ip;
        RETURN QUERY SELECT TRUE, 0, max_attempts - 1;
        RETURN;
    END IF;
    
    -- Incrémenter et vérifier
    IF current_record.attempt_count >= max_attempts THEN
        -- Bloquer
        UPDATE gift_code_rate_limits 
        SET blocked_until = NOW() + (block_minutes || ' minutes')::INTERVAL,
            last_attempt_at = NOW()
        WHERE gift_code_rate_limits.ip_address = client_ip;
        RETURN QUERY SELECT FALSE, block_minutes * 60, 0;
        RETURN;
    END IF;
    
    -- Incrémenter
    UPDATE gift_code_rate_limits 
    SET attempt_count = attempt_count + 1,
        last_attempt_at = NOW()
    WHERE gift_code_rate_limits.ip_address = client_ip;
    
    RETURN QUERY SELECT TRUE, 0, max_attempts - current_record.attempt_count - 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réinitialiser après succès
CREATE OR REPLACE FUNCTION reset_gift_code_rate_limit(client_ip INET)
RETURNS VOID AS $$
BEGIN
    DELETE FROM gift_code_rate_limits WHERE ip_address = client_ip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_gift_codes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gift_codes_updated_at
    BEFORE UPDATE ON gift_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_gift_codes_timestamp();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_code_rate_limits ENABLE ROW LEVEL SECURITY;

-- Seul le service role peut accéder (via API functions)
CREATE POLICY "Service role only" ON gift_codes
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON gift_code_attempts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON gift_code_rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Cleanup Job (à exécuter via pg_cron)
-- ============================================

-- Nettoyer les tentatives > 30 jours
-- SELECT cron.schedule('cleanup-gift-attempts', '0 3 * * *', 
--   'DELETE FROM gift_code_attempts WHERE attempted_at < NOW() - INTERVAL ''30 days''');

-- Expirer les codes périmés
-- SELECT cron.schedule('expire-gift-codes', '0 0 * * *', 
--   'UPDATE gift_codes SET status = ''expired'' WHERE status = ''active'' AND expires_at < NOW()');
