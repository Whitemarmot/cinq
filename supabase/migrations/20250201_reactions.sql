-- =============================================
-- Post Reactions Table
-- Emoji reactions on posts: ❤️ 😂 😮 😢 👏
-- =============================================

-- Create table
CREATE TABLE IF NOT EXISTS post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL CHECK (emoji IN ('❤️', '😂', '😮', '😢', '👏')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One reaction per user per post per emoji
    UNIQUE(post_id, user_id, emoji)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);

-- RLS Policies
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

-- Users can read all reactions (for displaying counts)
CREATE POLICY "Anyone can read reactions" ON post_reactions
    FOR SELECT USING (true);

-- Users can insert their own reactions
CREATE POLICY "Users can add reactions" ON post_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can remove own reactions" ON post_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, DELETE ON post_reactions TO authenticated;
