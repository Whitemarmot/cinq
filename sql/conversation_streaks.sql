-- ============================================
-- CONVERSATION STREAKS - Track consecutive days of conversation
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_message_date DATE DEFAULT CURRENT_DATE,
    streak_start_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_streaks_user ON conversation_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_streaks_contact ON conversation_streaks(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_streaks_current ON conversation_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_streaks_longest ON conversation_streaks(longest_streak DESC);

ALTER TABLE conversation_streaks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own streaks
CREATE POLICY "Users can view own streaks" ON conversation_streaks FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can create own streaks" ON conversation_streaks FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON conversation_streaks FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to update streak when a message is sent
CREATE OR REPLACE FUNCTION update_conversation_streak()
RETURNS TRIGGER AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
    current_streak_record RECORD;
BEGIN
    -- Update streak for sender -> receiver
    SELECT * INTO current_streak_record 
    FROM conversation_streaks 
    WHERE user_id = NEW.sender_id AND contact_user_id = NEW.receiver_id;
    
    IF current_streak_record IS NULL THEN
        -- Create new streak record
        INSERT INTO conversation_streaks (user_id, contact_user_id, current_streak, longest_streak, last_message_date, streak_start_date)
        VALUES (NEW.sender_id, NEW.receiver_id, 1, 1, today_date, today_date);
    ELSE
        -- Update existing streak
        IF current_streak_record.last_message_date = today_date THEN
            -- Same day, no change needed
            NULL;
        ELSIF current_streak_record.last_message_date = yesterday_date THEN
            -- Consecutive day, increment streak
            UPDATE conversation_streaks
            SET 
                current_streak = current_streak_record.current_streak + 1,
                longest_streak = GREATEST(current_streak_record.longest_streak, current_streak_record.current_streak + 1),
                last_message_date = today_date,
                updated_at = NOW()
            WHERE user_id = NEW.sender_id AND contact_user_id = NEW.receiver_id;
        ELSE
            -- Streak broken, reset
            UPDATE conversation_streaks
            SET 
                current_streak = 1,
                last_message_date = today_date,
                streak_start_date = today_date,
                updated_at = NOW()
            WHERE user_id = NEW.sender_id AND contact_user_id = NEW.receiver_id;
        END IF;
    END IF;
    
    -- Also update for receiver -> sender (bidirectional tracking)
    SELECT * INTO current_streak_record 
    FROM conversation_streaks 
    WHERE user_id = NEW.receiver_id AND contact_user_id = NEW.sender_id;
    
    IF current_streak_record IS NULL THEN
        INSERT INTO conversation_streaks (user_id, contact_user_id, current_streak, longest_streak, last_message_date, streak_start_date)
        VALUES (NEW.receiver_id, NEW.sender_id, 1, 1, today_date, today_date);
    ELSE
        IF current_streak_record.last_message_date = today_date THEN
            NULL;
        ELSIF current_streak_record.last_message_date = yesterday_date THEN
            UPDATE conversation_streaks
            SET 
                current_streak = current_streak_record.current_streak + 1,
                longest_streak = GREATEST(current_streak_record.longest_streak, current_streak_record.current_streak + 1),
                last_message_date = today_date,
                updated_at = NOW()
            WHERE user_id = NEW.receiver_id AND contact_user_id = NEW.sender_id;
        ELSE
            UPDATE conversation_streaks
            SET 
                current_streak = 1,
                last_message_date = today_date,
                streak_start_date = today_date,
                updated_at = NOW()
            WHERE user_id = NEW.receiver_id AND contact_user_id = NEW.sender_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update streaks on new messages
DROP TRIGGER IF EXISTS update_conversation_streak_trigger ON messages;
CREATE TRIGGER update_conversation_streak_trigger
    AFTER INSERT ON messages
    FOR EACH ROW 
    WHEN (NEW.is_ping = FALSE AND NEW.is_vacation_reply = FALSE AND NEW.is_auto_reply = FALSE)
    EXECUTE FUNCTION update_conversation_streak();