-- ============================================
-- CINQ - PROPOSALS (Proposer un moment)
-- Migration 004
-- ============================================

-- Proposals table
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Proposal details
    proposed_at TIMESTAMPTZ NOT NULL,
    location TEXT,
    message TEXT CHECK (char_length(message) <= 200),
    
    -- Status: pending | accepted | declined | expired
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    responded_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT no_self_proposal CHECK (sender_id != receiver_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_sender ON public.proposals(sender_id);
CREATE INDEX IF NOT EXISTS idx_proposals_receiver ON public.proposals(receiver_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_at ON public.proposals(proposed_at);
CREATE INDEX IF NOT EXISTS idx_proposals_conversation ON public.proposals(sender_id, receiver_id, created_at DESC);

-- RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals FORCE ROW LEVEL SECURITY;

-- Users can see proposals they sent or received
CREATE POLICY "proposals_select_own" ON public.proposals
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create proposals they send
CREATE POLICY "proposals_insert_own" ON public.proposals
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update proposals they received (to accept/decline)
CREATE POLICY "proposals_update_receiver" ON public.proposals
    FOR UPDATE USING (auth.uid() = receiver_id);

-- Trigger: Only allow proposals between contacts
CREATE OR REPLACE FUNCTION check_proposal_contact_relationship()
RETURNS TRIGGER AS $$
DECLARE
    is_contact BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE user_id = NEW.sender_id 
        AND contact_user_id = NEW.receiver_id
    ) INTO is_contact;
    
    IF NOT is_contact THEN
        RAISE EXCEPTION 'Cannot propose to someone who is not in your contacts';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_proposal_contact ON public.proposals;
CREATE TRIGGER enforce_proposal_contact
    BEFORE INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION check_proposal_contact_relationship();

-- Enable Realtime for proposals
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;

-- Comments
COMMENT ON TABLE public.proposals IS 'CINQ proposals - suggest a meetup to a contact';
COMMENT ON COLUMN public.proposals.proposed_at IS 'When the meetup is proposed for';
COMMENT ON COLUMN public.proposals.location IS 'Optional location for the meetup';
COMMENT ON COLUMN public.proposals.status IS 'pending/accepted/declined/expired';

-- ============================================
-- DONE! 📅
-- ============================================
