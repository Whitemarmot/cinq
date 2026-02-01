-- Migration: Add favorites support to contacts
-- Date: 2025-02-01
-- Description: Adds is_favorite column to contacts table for marking favorite contacts

-- Add is_favorite column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- Create index for faster favorite sorting
CREATE INDEX IF NOT EXISTS idx_contacts_user_favorite ON contacts(user_id, is_favorite DESC, created_at ASC);

-- Comment for documentation
COMMENT ON COLUMN contacts.is_favorite IS 'Whether this contact is marked as favorite (appears first in list)';
