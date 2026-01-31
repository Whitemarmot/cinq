-- CINQ Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    gift_code_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- GIFT CODES
-- ============================================
CREATE TABLE IF NOT EXISTS gift_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
    redeemed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_codes_code ON gift_codes(code);
CREATE INDEX IF NOT EXISTS idx_gift_codes_status ON gift_codes(status);

-- ============================================
-- CONTACTS (max 5 per user)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

-- Enforce max 5 contacts
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM contacts WHERE user_id = NEW.user_id) >= 5 THEN
        RAISE EXCEPTION 'Maximum 5 contacts allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_contact_limit ON contacts;
CREATE TRIGGER enforce_contact_limit
    BEFORE INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION check_contact_limit();

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_ping BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ============================================
-- PROPOSALS (meetup suggestions)
-- ============================================
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposed_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_users ON proposals(sender_id, receiver_id);

-- ============================================
-- PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    keys JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- ============================================
-- WAITLIST (already exists, but ensure schema)
-- ============================================
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users: can read own, update own
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Gift codes: creator can view their codes
CREATE POLICY "Users can view own gift codes" ON gift_codes FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create gift codes" ON gift_codes FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Contacts: user can manage their contacts
CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE USING (auth.uid() = user_id);

-- Messages: sender and receiver can view
CREATE POLICY "Users can view their messages" ON messages FOR SELECT 
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can mark messages read" ON messages FOR UPDATE 
    USING (auth.uid() = receiver_id);

-- Proposals: sender and receiver can view
CREATE POLICY "Users can view their proposals" ON proposals FOR SELECT 
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create proposals" ON proposals FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receiver can respond to proposals" ON proposals FOR UPDATE 
    USING (auth.uid() = receiver_id);

-- Push: user can manage their subscriptions
CREATE POLICY "Users can manage push subs" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- ============================================
-- For API routes using service role key
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
