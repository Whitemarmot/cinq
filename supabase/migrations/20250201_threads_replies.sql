-- Migration: Add threads/replies support to posts
-- Created: 2025-02-01

-- Add parent_id column for replies
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES posts(id) ON DELETE CASCADE;

-- Add index for efficient reply lookups
CREATE INDEX IF NOT EXISTS idx_posts_parent_id ON posts(parent_id) 
WHERE parent_id IS NOT NULL;

-- Add index for finding root posts (for feed)
CREATE INDEX IF NOT EXISTS idx_posts_root_posts ON posts(user_id, created_at DESC) 
WHERE parent_id IS NULL;

-- Add related_post_id to notifications for reply notifications
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS related_post_id UUID REFERENCES posts(id) ON DELETE CASCADE;

-- Comment on the new column
COMMENT ON COLUMN posts.parent_id IS 'Parent post ID for replies. NULL for root posts.';
COMMENT ON COLUMN notifications.related_post_id IS 'Related post ID for reply notifications (the parent post).';
