-- ============================================
-- CINQ Migration 005: User Profile Fields
-- ============================================
-- Adds display_name, bio, avatar_url, updated_at to users table
-- Required for profile editing functionality
-- ============================================

-- Add profile fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraints
ALTER TABLE public.users
ADD CONSTRAINT users_display_name_length CHECK (char_length(display_name) <= 50),
ADD CONSTRAINT users_bio_length CHECK (char_length(bio) <= 500);

-- Create index for display_name lookups
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users(display_name) WHERE display_name IS NOT NULL;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_timestamp();

-- Comments
COMMENT ON COLUMN public.users.display_name IS 'User display name (max 50 chars)';
COMMENT ON COLUMN public.users.bio IS 'User bio/description (max 500 chars)';
COMMENT ON COLUMN public.users.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.users.updated_at IS 'Last profile update timestamp';

-- ============================================
-- Done! Profile fields added to users table
-- ============================================
