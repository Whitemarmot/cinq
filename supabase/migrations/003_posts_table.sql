-- POSTS table for Cinq Feed
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/guioxfulihyehrwytxce/sql

-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can view posts from their contacts + their own posts
CREATE POLICY "Users can view contacts posts" ON posts FOR SELECT
    USING (
        user_id IN (
            SELECT contact_user_id FROM contacts WHERE user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Users can create their own posts
CREATE POLICY "Users can create own posts" ON posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- GRANT SERVICE ROLE ACCESS
-- ============================================
GRANT ALL ON posts TO service_role;
