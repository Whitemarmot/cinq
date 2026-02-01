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
    vacation_mode BOOLEAN DEFAULT FALSE,
    vacation_message TEXT DEFAULT 'Je suis en vacances ! Je te réponds dès mon retour 🌴',
    focus_mode BOOLEAN DEFAULT FALSE,
    focus_start TEXT DEFAULT '09:00',
    focus_end TEXT DEFAULT '18:00',
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

-- Add vacation mode columns if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vacation_mode') THEN
        ALTER TABLE users ADD COLUMN vacation_mode BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vacation_message') THEN
        ALTER TABLE users ADD COLUMN vacation_message TEXT DEFAULT 'Je suis en vacances ! Je te réponds dès mon retour 🌴';
    END IF;
END $$;

-- Add focus mode columns if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='focus_mode') THEN
        ALTER TABLE users ADD COLUMN focus_mode BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='focus_start') THEN
        ALTER TABLE users ADD COLUMN focus_start TEXT DEFAULT '09:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='focus_end') THEN
        ALTER TABLE users ADD COLUMN focus_end TEXT DEFAULT '18:00';
    END IF;
END $$;

-- Add user status columns (WhatsApp-style status)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status_emoji') THEN
        ALTER TABLE users ADD COLUMN status_emoji TEXT DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status_text') THEN
        ALTER TABLE users ADD COLUMN status_text TEXT DEFAULT NULL CHECK (char_length(status_text) <= 60);
    END IF;
END $$;

-- Add mood indicator column (😊😐😔🎉🤒)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mood') THEN
        ALTER TABLE users ADD COLUMN mood TEXT DEFAULT NULL CHECK (mood IN ('😊', '😐', '😔', '🎉', '🤒', NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mood_updated_at') THEN
        ALTER TABLE users ADD COLUMN mood_updated_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Add last seen columns (presence tracking)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_seen_at') THEN
        ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='hide_last_seen') THEN
        ALTER TABLE users ADD COLUMN hide_last_seen BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add birthday column if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='birthday') THEN
        ALTER TABLE users ADD COLUMN birthday DATE DEFAULT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);

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

-- Add is_favorite and archived columns (migrations for existing DBs)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add muted_until column for contact muting feature
-- NULL = not muted, timestamp = muted until that time, 'infinity' = muted indefinitely
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ DEFAULT NULL;

-- Add private_note column for private notes about contacts (visible only by the user)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS private_note TEXT DEFAULT NULL;

-- Add contact_group column for grouping contacts (famille, travail, amis)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_group TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_group ON contacts(user_id, contact_group);

CREATE INDEX IF NOT EXISTS idx_contacts_archived ON contacts(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_contacts_muted ON contacts(user_id, muted_until);

-- Enforce max 5 contacts (only non-archived)
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Only count non-archived contacts towards the limit
    IF (SELECT COUNT(*) FROM contacts WHERE user_id = NEW.user_id AND (archived IS NULL OR archived = FALSE)) >= 5 THEN
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
-- IGNORED SUGGESTIONS (friends of friends to hide)
-- ============================================
CREATE TABLE IF NOT EXISTS ignored_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ignored_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ignored_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ignored_suggestions_user ON ignored_suggestions(user_id);

ALTER TABLE ignored_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage ignored suggestions" ON ignored_suggestions 
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_ping BOOLEAN DEFAULT FALSE,
    is_vacation_reply BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Add is_vacation_reply column if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_vacation_reply') THEN
        ALTER TABLE messages ADD COLUMN is_vacation_reply BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add sticker_id column if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sticker_id') THEN
        ALTER TABLE messages ADD COLUMN sticker_id VARCHAR(50);
    END IF;
END $$;

-- Add gif_url column if not exists (GIPHY integration)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='gif_url') THEN
        ALTER TABLE messages ADD COLUMN gif_url TEXT;
    END IF;
END $$;

-- Add reply_to_id column if not exists (reply to message feature)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='reply_to_id') THEN
        ALTER TABLE messages ADD COLUMN reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);

-- ============================================
-- READ RECEIPTS (accusés de lecture)
-- ============================================
CREATE TABLE IF NOT EXISTS read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_reader ON read_receipts(reader_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_read_at ON read_receipts(read_at DESC);

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
ALTER TABLE read_receipts ENABLE ROW LEVEL SECURITY;
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

-- Read receipts: reader can create, sender can view
CREATE POLICY "Users can view read receipts for their messages" ON read_receipts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = read_receipts.message_id 
            AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
        )
    );
CREATE POLICY "Users can create read receipts" ON read_receipts FOR INSERT 
    WITH CHECK (auth.uid() = reader_id);

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

-- Add is_gif column if not exists (GIPHY integration for posts)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='is_gif') THEN
        ALTER TABLE posts ADD COLUMN is_gif BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

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
-- ACCOUNT DELETIONS (GDPR Compliance)
-- ============================================
CREATE TABLE IF NOT EXISTS account_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_user ON account_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletions_status ON account_deletions(status);
CREATE INDEX IF NOT EXISTS idx_account_deletions_scheduled ON account_deletions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_account_deletions_pending ON account_deletions(status, scheduled_at) WHERE status = 'pending';

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
-- No policies = only service role key works

-- ============================================
-- NOTIFICATIONS (mentions, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('post_mention', 'message_mention', 'new_contact', 'system')),
    reference_id UUID,
    content TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications 
    FOR DELETE USING (auth.uid() = user_id);
-- Only service role can insert (API creates notifications)

-- ============================================
-- BOOKMARKS (favorites)
-- ============================================
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id ON bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Bookmarks: users can manage their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ACTIVITY LOG (user activity history)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own activity log
CREATE POLICY "Users can view own activity log" ON activity_log 
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert (API-only)
-- No insert policy for regular users = service role only

-- ============================================
-- POST TAGS (hashtags)
-- ============================================
CREATE TABLE IF NOT EXISTS post_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_created ON post_tags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_created ON post_tags(tag, created_at DESC);

ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- Post tags: users can view tags on posts they can see
CREATE POLICY "Users can view tags on visible posts" ON post_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = post_tags.post_id 
            AND (
                posts.user_id = auth.uid() 
                OR posts.user_id IN (
                    SELECT contact_user_id FROM contacts WHERE user_id = auth.uid()
                )
            )
        )
    );

-- ============================================
-- STORIES (ephemeral 24h content)
-- ============================================
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT CHECK (char_length(content) <= 500),
    image_url TEXT,
    background_color TEXT DEFAULT '#1a1a2e',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_active ON stories(expires_at) WHERE expires_at > NOW();

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Stories: users can view their own and contacts' active stories
CREATE POLICY "Users can view contacts stories" ON stories FOR SELECT
    USING (
        expires_at > NOW() AND (
            user_id = auth.uid() 
            OR user_id IN (
                SELECT contact_user_id FROM contacts WHERE user_id = auth.uid()
            )
        )
    );
CREATE POLICY "Users can create own stories" ON stories FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON stories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- STORY VIEWS (track who viewed stories)
-- ============================================
CREATE TABLE IF NOT EXISTS story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Story views: story owner can see who viewed, viewers can create views
CREATE POLICY "Story owners can view who watched" ON story_views FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM stories 
            WHERE stories.id = story_views.story_id 
            AND stories.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can mark stories as viewed" ON story_views FOR INSERT
    WITH CHECK (auth.uid() = viewer_id);

-- ============================================
-- POLL VOTES
-- ============================================
-- Add poll columns to posts table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='poll_options') THEN
        ALTER TABLE posts ADD COLUMN poll_options JSONB DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='poll_votes') THEN
        ALTER TABLE posts ADD COLUMN poll_votes JSONB DEFAULT NULL;
    END IF;
END $$;

-- Poll votes table (tracks who voted for which option)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id) -- One vote per user per poll
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_post_id ON poll_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes(user_id);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Poll votes: users can view votes on posts they can see
CREATE POLICY "Users can view poll votes on visible posts" ON poll_votes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = poll_votes.post_id 
            AND (
                posts.user_id = auth.uid() 
                OR posts.user_id IN (
                    SELECT contact_user_id FROM contacts WHERE user_id = auth.uid()
                )
            )
        )
    );

-- ============================================
-- PINNED MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pinned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_user ON pinned_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_contact ON pinned_messages(user_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_pinned_at ON pinned_messages(pinned_at DESC);

ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own pinned messages
CREATE POLICY "Users can view own pinned messages" ON pinned_messages FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY "Users can pin messages" ON pinned_messages FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unpin messages" ON pinned_messages FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================
-- REMINDERS
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remind_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_message ON reminders(message_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at ASC) WHERE triggered = FALSE;
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at) WHERE triggered = FALSE;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own reminders
CREATE POLICY "Users can view own reminders" ON reminders FOR SELECT 
    USING (auth.uid() = user_id);
CREATE POLICY "Users can create reminders" ON reminders FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON reminders FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete reminders" ON reminders FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================
-- POST VIEWS (seen by - for posts < 24h)
-- ============================================
CREATE TABLE IF NOT EXISTS post_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_id ON post_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at DESC);

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- Post views: post owner can see who viewed, viewers can create views
CREATE POLICY "Post owners can view who watched" ON post_views FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = post_views.post_id 
            AND posts.user_id = auth.uid()
        )
        OR viewer_id = auth.uid()
    );
CREATE POLICY "Users can mark posts as viewed" ON post_views FOR INSERT
    WITH CHECK (auth.uid() = viewer_id);

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- ============================================
-- For API routes using service role key
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
