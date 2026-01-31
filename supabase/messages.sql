-- ============================================
-- CINQ - Messages Schema
-- Simple, zen messaging between contacts
-- ============================================

-- ============================================
-- 1. MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    is_ping BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Prevent self-messaging
    CONSTRAINT no_self_message CHECK (sender_id != receiver_id)
);

-- Indexes for conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);

-- ============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "messages_select_own"
    ON public.messages
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages (insert) only as themselves
CREATE POLICY "messages_insert_own"
    ON public.messages
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- No update policy - messages are immutable

-- Users can only delete messages they sent
CREATE POLICY "messages_delete_own"
    ON public.messages
    FOR DELETE
    USING (auth.uid() = sender_id);

-- ============================================
-- 3. TRIGGER: Only allow messaging between contacts
-- ============================================
CREATE OR REPLACE FUNCTION check_contact_relationship()
RETURNS TRIGGER AS $$
DECLARE
    is_contact BOOLEAN;
BEGIN
    -- Check if receiver is a contact of sender
    SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE user_id = NEW.sender_id 
        AND contact_user_id = NEW.receiver_id
    ) INTO is_contact;
    
    IF NOT is_contact THEN
        RAISE EXCEPTION 'Cannot message someone who is not in your contacts';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_contact_messaging ON public.messages;
CREATE TRIGGER enforce_contact_messaging
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION check_contact_relationship();

-- ============================================
-- 4. REALTIME SUBSCRIPTION
-- ============================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.messages IS 'CINQ messages - simple text between contacts';
COMMENT ON COLUMN public.messages.is_ping IS 'True for ping (just "thinking of you") messages';
COMMENT ON COLUMN public.messages.content IS 'Message content, max 500 chars (anti-rant limit)';
