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
    banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add banned column if not exists (for existing deployments)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='banned') THEN
        ALTER TABLE users ADD COLUMN banned BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

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
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

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

-- Posts: users can view their own and contacts' posts
CREATE POLICY "Users can view contacts posts" ON posts FOR SELECT
    USING (
        user_id IN (
            SELECT contact_user_id FROM contacts WHERE user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );
CREATE POLICY "Users can create own posts" ON posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- POSTS (feed)
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- ============================================
-- ANALYTICS EVENTS (server-side)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type_created ON analytics_events(event_type, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
-- No policies = only service role key works

-- ============================================
-- CLIENT ANALYTICS (frontend tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS client_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    session_id TEXT,
    visitor_id TEXT,
    page_url TEXT,
    page_title TEXT,
    page_referrer TEXT,
    viewport TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    language TEXT,
    platform TEXT,
    event_data JSONB DEFAULT '{}',
    ip_hash TEXT,
    user_agent TEXT,
    client_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_analytics_event_type ON client_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_client_analytics_created ON client_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_analytics_session ON client_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_client_analytics_visitor ON client_analytics(visitor_id);
CREATE INDEX IF NOT EXISTS idx_client_analytics_page ON client_analytics(page_url);
CREATE INDEX IF NOT EXISTS idx_client_analytics_type_time ON client_analytics(event_type, created_at DESC);

ALTER TABLE client_analytics ENABLE ROW LEVEL SECURITY;
-- No policies = only service role key works

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- ============================================
-- For API routes using service role key
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
