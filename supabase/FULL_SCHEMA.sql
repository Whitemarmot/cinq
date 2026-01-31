-- ============================================
-- CINQ - FULL DATABASE SCHEMA
-- ============================================
-- Generated: Auto-merged from all migrations
-- Usage: Copy-paste entire file into Supabase SQL Editor
-- 
-- Order:
--   1. Extensions
--   2. Waitlist (landing page)
--   3. Users & Contacts (core)
--   4. Messages (communication)
--   5. Gift Codes System (monetization)
--   6. BTCPay Webhook Logs (payments)
--   7. Email Queue (notifications)
--   8. Login Attempts (security)
-- ============================================


-- ============================================
-- SECTION 1: EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================
-- SECTION 2: WAITLIST (Landing Page)
-- ============================================

CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON public.waitlist(created_at DESC);

-- RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_public_insert" ON public.waitlist
    FOR INSERT WITH CHECK (true);

CREATE POLICY "waitlist_service_select" ON public.waitlist
    FOR SELECT USING (auth.role() = 'service_role');

-- Public counter view
CREATE OR REPLACE VIEW public.waitlist_count AS
SELECT COUNT(*) as count FROM public.waitlist;

CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM public.waitlist;
$$ LANGUAGE SQL SECURITY DEFINER;


-- ============================================
-- SECTION 3: USERS & CONTACTS (Core)
-- ============================================

-- 3.1 Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    gift_code_used TEXT DEFAULT NULL,
    
    -- Profile fields (added in migration 005)
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_display_name_length CHECK (char_length(display_name) <= 50),
    CONSTRAINT users_bio_length CHECK (char_length(bio) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- 3.2 Contacts Table (max 5 per user = CINQ)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT no_self_contact CHECK (user_id != contact_user_id),
    CONSTRAINT unique_contact_pair UNIQUE (user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON public.contacts(contact_user_id);

-- 3.3 Trigger: Enforce 5 contacts limit
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
    contact_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO contact_count
    FROM public.contacts
    WHERE user_id = NEW.user_id;
    
    IF contact_count >= 5 THEN
        RAISE EXCEPTION 'CINQ limit reached: maximum 5 contacts per user';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_contact_limit ON public.contacts;
CREATE TRIGGER enforce_contact_limit
    BEFORE INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION check_contact_limit();

-- 3.4 RLS for Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_insert_service" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3.5 RLS for Contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_own" ON public.contacts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "contacts_insert_own" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contacts_delete_own" ON public.contacts
    FOR DELETE USING (auth.uid() = user_id);

-- 3.6 Auto-create user on Supabase Auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- 3.7 Helper: Get contact count
CREATE OR REPLACE FUNCTION get_contact_count(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM public.contacts WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER;


-- ============================================
-- SECTION 4: MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    is_ping BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT no_self_message CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);

-- 4.1 RLS for Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_insert_own" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages_delete_own" ON public.messages
    FOR DELETE USING (auth.uid() = sender_id);

-- 4.2 Trigger: Only allow messaging between contacts
CREATE OR REPLACE FUNCTION check_contact_relationship()
RETURNS TRIGGER AS $$
DECLARE
    is_contact BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE user_id = NEW.sender_id 
        AND contact_user_id = NEW.receiver_id
    ) INTO is_contact;
    
    IF NOT is_contact THEN
        RAISE EXCEPTION 'Cannot message someone who is not in your contacts';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_contact_messaging ON public.messages;
CREATE TRIGGER enforce_contact_messaging
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION check_contact_relationship();

-- 4.3 Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 4.4 Helper: Get conversations summary
CREATE OR REPLACE FUNCTION get_conversations(p_user_id UUID)
RETURNS TABLE (contact_id UUID, last_message_at TIMESTAMPTZ, message_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END,
        MAX(m.created_at),
        COUNT(*)
    FROM public.messages m
    WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
    GROUP BY CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END
    ORDER BY MAX(m.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.5 Helper: Send ping
CREATE OR REPLACE FUNCTION send_ping(p_sender_id UUID, p_receiver_id UUID)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.messages (sender_id, receiver_id, content, is_ping)
    VALUES (p_sender_id, p_receiver_id, '🫰', TRUE)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SECTION 4B: PROPOSALS (Proposer un moment)
-- ============================================

CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Proposal details
    proposed_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    message TEXT CHECK (char_length(message) <= 200),
    
    -- Status: pending | accepted | declined | expired
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    responded_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT no_self_proposal CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_sender ON public.proposals(sender_id);
CREATE INDEX IF NOT EXISTS idx_proposals_receiver ON public.proposals(receiver_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_at ON public.proposals(proposed_at);
CREATE INDEX IF NOT EXISTS idx_proposals_conversation ON public.proposals(sender_id, receiver_id, created_at DESC);

-- RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals FORCE ROW LEVEL SECURITY;

CREATE POLICY "proposals_select_own" ON public.proposals
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "proposals_insert_own" ON public.proposals
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "proposals_update_receiver" ON public.proposals
    FOR UPDATE USING (auth.uid() = receiver_id);

-- Trigger: Only allow proposals between contacts
CREATE OR REPLACE FUNCTION check_proposal_contact_relationship()
RETURNS TRIGGER AS $$
DECLARE
    is_contact BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE user_id = NEW.sender_id 
        AND contact_user_id = NEW.receiver_id
    ) INTO is_contact;
    
    IF NOT is_contact THEN
        RAISE EXCEPTION 'Cannot propose to someone who is not in your contacts';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_proposal_contact ON public.proposals;
CREATE TRIGGER enforce_proposal_contact
    BEFORE INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION check_proposal_contact_relationship();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;


-- ============================================
-- SECTION 5: GIFT CODES SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.gift_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
    
    -- Purchaser info
    purchaser_email TEXT,
    purchaser_name TEXT,
    purchase_order_id TEXT,
    
    -- Recipient info (optional)
    recipient_email TEXT,
    recipient_name TEXT,
    gift_message TEXT,
    
    -- Redemption
    redeemed_by UUID REFERENCES auth.users(id),
    redeemed_at TIMESTAMPTZ,
    redeemed_order_id TEXT,
    
    -- Payment info (BTCPay)
    payment_method TEXT,
    payment_details JSONB,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Anti-fraud: visible prefix for support
    code_prefix TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gift_codes_hash ON public.gift_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_gift_codes_status ON public.gift_codes(status);
CREATE INDEX IF NOT EXISTS idx_gift_codes_prefix ON public.gift_codes(code_prefix);
CREATE INDEX IF NOT EXISTS idx_gift_codes_expires ON public.gift_codes(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_gift_codes_payment_method ON public.gift_codes(payment_method);

-- 5.1 Rate Limiting: Attempts Table
CREATE TABLE IF NOT EXISTS public.gift_code_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempted_code_hash TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_ip_time ON public.gift_code_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_cleanup ON public.gift_code_attempts(attempted_at);

-- 5.2 Rate Limiting: State Table
CREATE TABLE IF NOT EXISTS public.gift_code_rate_limits (
    ip_address INET PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked_until TIMESTAMPTZ
);

-- 5.3 Trigger: Auto-update timestamp
CREATE OR REPLACE FUNCTION update_gift_codes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_codes_updated_at ON public.gift_codes;
CREATE TRIGGER gift_codes_updated_at
    BEFORE UPDATE ON public.gift_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_gift_codes_timestamp();

-- 5.4 Function: Check rate limit
CREATE OR REPLACE FUNCTION check_gift_code_rate_limit(client_ip INET)
RETURNS TABLE(allowed BOOLEAN, wait_seconds INTEGER, attempts_remaining INTEGER) AS $$
DECLARE
    max_attempts INTEGER := 5;
    window_minutes INTEGER := 15;
    block_minutes INTEGER := 60;
    current_record RECORD;
BEGIN
    SELECT * INTO current_record FROM public.gift_code_rate_limits WHERE gift_code_rate_limits.ip_address = client_ip;
    
    IF NOT FOUND THEN
        INSERT INTO public.gift_code_rate_limits (ip_address) VALUES (client_ip);
        RETURN QUERY SELECT TRUE, 0, max_attempts - 1;
        RETURN;
    END IF;
    
    IF current_record.blocked_until IS NOT NULL AND current_record.blocked_until > NOW() THEN
        RETURN QUERY SELECT FALSE, 
            EXTRACT(EPOCH FROM (current_record.blocked_until - NOW()))::INTEGER,
            0;
        RETURN;
    END IF;
    
    IF current_record.first_attempt_at < NOW() - (window_minutes || ' minutes')::INTERVAL THEN
        UPDATE public.gift_code_rate_limits 
        SET attempt_count = 1, 
            first_attempt_at = NOW(), 
            last_attempt_at = NOW(),
            blocked_until = NULL
        WHERE gift_code_rate_limits.ip_address = client_ip;
        RETURN QUERY SELECT TRUE, 0, max_attempts - 1;
        RETURN;
    END IF;
    
    IF current_record.attempt_count >= max_attempts THEN
        UPDATE public.gift_code_rate_limits 
        SET blocked_until = NOW() + (block_minutes || ' minutes')::INTERVAL,
            last_attempt_at = NOW()
        WHERE gift_code_rate_limits.ip_address = client_ip;
        RETURN QUERY SELECT FALSE, block_minutes * 60, 0;
        RETURN;
    END IF;
    
    UPDATE public.gift_code_rate_limits 
    SET attempt_count = attempt_count + 1,
        last_attempt_at = NOW()
    WHERE gift_code_rate_limits.ip_address = client_ip;
    
    RETURN QUERY SELECT TRUE, 0, max_attempts - current_record.attempt_count - 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.5 Function: Reset rate limit on success
CREATE OR REPLACE FUNCTION reset_gift_code_rate_limit(client_ip INET)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.gift_code_rate_limits WHERE ip_address = client_ip;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.6 RLS for Gift Codes (service role only)
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_code_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_codes_service_only" ON public.gift_codes
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "gift_code_attempts_service_only" ON public.gift_code_attempts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "gift_code_rate_limits_service_only" ON public.gift_code_rate_limits
    FOR ALL USING (auth.role() = 'service_role');


-- ============================================
-- SECTION 6: BTCPAY WEBHOOK LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.btcpay_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    invoice_id TEXT NOT NULL,
    store_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    gift_code_id UUID REFERENCES public.gift_codes(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_btcpay_logs_invoice_id ON public.btcpay_webhook_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_event_type ON public.btcpay_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_received_at ON public.btcpay_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_btcpay_logs_processed ON public.btcpay_webhook_logs(processed) WHERE processed = FALSE;

ALTER TABLE public.btcpay_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "btcpay_logs_service_only" ON public.btcpay_webhook_logs
    FOR ALL USING (auth.role() = 'service_role');


-- ============================================
-- SECTION 7: EMAIL QUEUE
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template TEXT NOT NULL,
    to_email TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at DESC);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_queue_service_only" ON public.email_queue
    FOR ALL USING (auth.role() = 'service_role');


-- ============================================
-- SECTION 8: LOGIN ATTEMPTS (Security)
-- ============================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    email_hash TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
    ON public.login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_cleanup 
    ON public.login_attempts(created_at);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_attempts_service_only" ON public.login_attempts
    FOR ALL USING (auth.role() = 'service_role');


-- ============================================
-- SECTION 9: TABLE COMMENTS
-- ============================================

COMMENT ON TABLE public.waitlist IS 'Landing page waitlist signups';
COMMENT ON TABLE public.users IS 'CINQ users - zero-knowledge ready';
COMMENT ON TABLE public.contacts IS 'CINQ contacts - max 5 per user enforced by trigger';
COMMENT ON TABLE public.messages IS 'CINQ messages - simple text between contacts';
COMMENT ON COLUMN public.messages.is_ping IS 'True for ping (thinking of you) messages';
COMMENT ON COLUMN public.messages.content IS 'Message content, max 500 chars';
COMMENT ON TABLE public.proposals IS 'CINQ proposals - suggest a meetup to a contact';
COMMENT ON COLUMN public.proposals.proposed_at IS 'When the meetup is proposed for';
COMMENT ON COLUMN public.proposals.status IS 'pending/accepted/declined/expired';
COMMENT ON TABLE public.gift_codes IS 'Gift codes for monetization';
COMMENT ON TABLE public.gift_code_attempts IS 'Anti-bruteforce tracking';
COMMENT ON TABLE public.gift_code_rate_limits IS 'Rate limiting state per IP';
COMMENT ON TABLE public.btcpay_webhook_logs IS 'Audit log of BTCPay webhook events';
COMMENT ON TABLE public.email_queue IS 'Queue for outgoing email notifications';
COMMENT ON TABLE public.login_attempts IS 'Rate limiting for login attempts';
COMMENT ON FUNCTION check_contact_limit() IS 'Enforces CINQ limit of 5 contacts';
COMMENT ON FUNCTION check_contact_relationship() IS 'Ensures users can only message their contacts';
COMMENT ON FUNCTION check_proposal_contact_relationship() IS 'Ensures users can only propose to their contacts';


-- ============================================
-- DONE! 🎉
-- ============================================
-- Tables created: 11 (+proposals)
-- Functions created: 10
-- Triggers created: 6
-- RLS policies: All tables protected
-- ============================================
