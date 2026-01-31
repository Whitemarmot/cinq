-- ============================================
-- CINQ - Users Schema
-- Zero-knowledge ready architecture
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    gift_code_used TEXT DEFAULT NULL,
    
    -- Zero-knowledge ready: no personal data stored
    -- Future: encrypted_profile BYTEA for E2E encrypted user data
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- ============================================
-- 2. CONTACTS TABLE (max 5 per user)
-- ============================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent self-contact and duplicates
    CONSTRAINT no_self_contact CHECK (user_id != contact_user_id),
    CONSTRAINT unique_contact_pair UNIQUE (user_id, contact_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON public.contacts(contact_user_id);

-- ============================================
-- 3. TRIGGER: Limit contacts to 5 per user
-- ============================================
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
    contact_count INTEGER;
BEGIN
    -- Count existing contacts for this user
    SELECT COUNT(*) INTO contact_count
    FROM public.contacts
    WHERE user_id = NEW.user_id;
    
    -- CINQ = 5 contacts max, c'est le concept
    IF contact_count >= 5 THEN
        RAISE EXCEPTION 'CINQ limit reached: maximum 5 contacts per user';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_contact_limit ON public.contacts;
CREATE TRIGGER enforce_contact_limit
    BEFORE INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION check_contact_limit();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on both tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;

-- ----------------------------------------
-- USERS TABLE POLICIES
-- ----------------------------------------

-- Users can only read their own profile
CREATE POLICY "users_select_own"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "users_update_own"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Insert handled by Supabase Auth trigger (service role only)
CREATE POLICY "users_insert_service"
    ON public.users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- No delete policy - users cannot delete themselves (admin only)

-- ----------------------------------------
-- CONTACTS TABLE POLICIES
-- ----------------------------------------

-- Users can only see their own contacts
CREATE POLICY "contacts_select_own"
    ON public.contacts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert contacts for themselves
CREATE POLICY "contacts_insert_own"
    ON public.contacts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own contacts
CREATE POLICY "contacts_delete_own"
    ON public.contacts
    FOR DELETE
    USING (auth.uid() = user_id);

-- No update policy - contacts are immutable (delete and recreate)

-- ============================================
-- 5. HELPER FUNCTION: Get contact count
-- ============================================
CREATE OR REPLACE FUNCTION get_contact_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM public.contacts
    WHERE user_id = p_user_id;
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. AUTO-CREATE USER ON AUTH SIGNUP
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

-- Trigger on Supabase auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.users IS 'CINQ users - zero-knowledge ready';
COMMENT ON TABLE public.contacts IS 'CINQ contacts - max 5 per user';
COMMENT ON COLUMN public.users.gift_code_used IS 'Gift code used during signup (if any)';
COMMENT ON FUNCTION check_contact_limit() IS 'Enforces the CINQ limit of 5 contacts per user';
