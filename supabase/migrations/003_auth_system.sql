-- ============================================
-- CINQ Auth System - Migration 002
-- SARAH Backend - Complete Auth Infrastructure
-- ============================================

-- Run after: 001_initial (waitlist, gift_codes)
-- Includes: users, contacts, messages, login_attempts

-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 2. USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    gift_code_used TEXT DEFAULT NULL,
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- ============================================
-- 3. CONTACTS TABLE (max 5 per user)
-- ============================================

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

-- Trigger: Limit to 5 contacts (CINQ)
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

-- ============================================
-- 4. MESSAGES TABLE (already exists in messages.sql)
-- ============================================

-- Note: messages.sql already defines:
-- - id, sender_id, receiver_id, content, is_ping, created_at
-- - RLS policies
-- - check_contact_relationship trigger
-- 
-- If not exists, run supabase/messages.sql first

-- ============================================
-- 5. LOGIN ATTEMPTS (Rate Limiting)
-- ============================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    email_hash TEXT NOT NULL, -- SHA256 hash, not raw email
    success BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
    ON public.login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_cleanup 
    ON public.login_attempts(created_at);

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_insert_service" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_own" ON public.contacts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contacts_insert_own" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_delete_own" ON public.contacts
    FOR DELETE USING (auth.uid() = user_id);

-- Messages RLS defined in messages.sql

-- Login Attempts (service role only)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_attempts_service" ON public.login_attempts
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Get contact count
CREATE OR REPLACE FUNCTION get_contact_count(p_user_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM public.contacts WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get conversations summary (uses receiver_id from messages.sql)
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

-- Send ping (uses receiver_id and content from messages.sql)
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
-- 8. AUTH TRIGGER: Auto-create user on signup
-- ============================================

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

-- ============================================
-- 9. COMMENTS
-- ============================================

COMMENT ON TABLE public.users IS 'CINQ users - zero-knowledge ready';
COMMENT ON TABLE public.contacts IS 'CINQ contacts - max 5 per user enforced by trigger';
COMMENT ON TABLE public.messages IS 'CINQ messages - E2E encrypted content';
COMMENT ON TABLE public.login_attempts IS 'Rate limiting for login attempts';
COMMENT ON FUNCTION check_contact_limit() IS 'Enforces CINQ limit of 5 contacts';
-- check_contact_relationship defined in messages.sql

-- ============================================
-- DONE! 🎉
-- ============================================
