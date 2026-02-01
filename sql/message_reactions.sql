-- ============================================
-- MESSAGE REACTIONS - Emoji reactions on messages
-- ============================================
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL CHECK (emoji IN ('❤️', '😂', '😮', '😢', '👏', '🔥', '👍', '👎')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions(emoji);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can only react to messages they can see (same as message policy)
CREATE POLICY "Users can react to visible messages" ON message_reactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = message_reactions.message_id 
            AND (
                messages.sender_id = auth.uid() 
                OR messages.receiver_id = auth.uid()
            )
        )
    );