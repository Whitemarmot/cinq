-- ============================================
-- CINQ - NEW FEATURES SQL MIGRATIONS
-- Execute this in your Supabase SQL Editor to add the new features:
-- 1. Message Reactions
-- 2. Conversation Streaks  
-- 3. Birthday Reminders
-- ============================================

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

-- ============================================
-- BIRTHDAY REMINDERS - Automatic birthday notifications
-- ============================================
CREATE TABLE IF NOT EXISTS birthday_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL, -- When to send the reminder
    birthday_date DATE NOT NULL, -- The actual birthday
    year INTEGER NOT NULL, -- Year of this birthday occurrence
    sent_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_birthday_reminders_user ON birthday_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_reminders_reminder_date ON birthday_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_birthday_reminders_pending ON birthday_reminders(reminder_date) WHERE sent_at IS NULL;

ALTER TABLE birthday_reminders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own birthday reminders
CREATE POLICY "Users can view own birthday reminders" ON birthday_reminders FOR ALL
    USING (auth.uid() = user_id);

-- Function to generate birthday reminders for the upcoming year
CREATE OR REPLACE FUNCTION generate_birthday_reminders()
RETURNS void AS $$
DECLARE
    contact_record RECORD;
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    next_year INTEGER := current_year + 1;
    birthday_this_year DATE;
    birthday_next_year DATE;
    reminder_date_this_year DATE;
    reminder_date_next_year DATE;
BEGIN
    -- Generate reminders for all contacts with birthdays
    FOR contact_record IN 
        SELECT DISTINCT 
            c.user_id, 
            c.contact_user_id,
            u.birthday
        FROM contacts c
        JOIN users u ON u.id = c.contact_user_id
        WHERE u.birthday IS NOT NULL
          AND c.archived = FALSE
    LOOP
        -- Calculate birthdays for this year and next year
        birthday_this_year := DATE(current_year || '-' || EXTRACT(MONTH FROM contact_record.birthday) || '-' || EXTRACT(DAY FROM contact_record.birthday));
        birthday_next_year := DATE(next_year || '-' || EXTRACT(MONTH FROM contact_record.birthday) || '-' || EXTRACT(DAY FROM contact_record.birthday));
        
        -- Set reminder date (1 day before birthday)
        reminder_date_this_year := birthday_this_year - INTERVAL '1 day';
        reminder_date_next_year := birthday_next_year - INTERVAL '1 day';
        
        -- Create reminder for this year if birthday hasn't passed and reminder doesn't exist
        IF birthday_this_year >= CURRENT_DATE THEN
            INSERT INTO birthday_reminders (user_id, contact_user_id, reminder_date, birthday_date, year)
            VALUES (contact_record.user_id, contact_record.contact_user_id, reminder_date_this_year, birthday_this_year, current_year)
            ON CONFLICT (user_id, contact_user_id, year) DO NOTHING;
        END IF;
        
        -- Always create reminder for next year
        INSERT INTO birthday_reminders (user_id, contact_user_id, reminder_date, birthday_date, year)
        VALUES (contact_record.user_id, contact_record.contact_user_id, reminder_date_next_year, birthday_next_year, next_year)
        ON CONFLICT (user_id, contact_user_id, year) DO NOTHING;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to trigger when a contact is added with a birthday
CREATE OR REPLACE FUNCTION handle_new_contact_birthday()
RETURNS TRIGGER AS $$
DECLARE
    contact_birthday DATE;
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    next_year INTEGER := current_year + 1;
    birthday_this_year DATE;
    birthday_next_year DATE;
BEGIN
    -- Get the contact's birthday
    SELECT birthday INTO contact_birthday
    FROM users
    WHERE id = NEW.contact_user_id;
    
    -- If contact has a birthday, create reminders
    IF contact_birthday IS NOT NULL THEN
        birthday_this_year := DATE(current_year || '-' || EXTRACT(MONTH FROM contact_birthday) || '-' || EXTRACT(DAY FROM contact_birthday));
        birthday_next_year := DATE(next_year || '-' || EXTRACT(MONTH FROM contact_birthday) || '-' || EXTRACT(DAY FROM contact_birthday));
        
        -- Create reminder for this year if birthday hasn't passed
        IF birthday_this_year >= CURRENT_DATE THEN
            INSERT INTO birthday_reminders (user_id, contact_user_id, reminder_date, birthday_date, year)
            VALUES (NEW.user_id, NEW.contact_user_id, birthday_this_year - INTERVAL '1 day', birthday_this_year, current_year)
            ON CONFLICT (user_id, contact_user_id, year) DO NOTHING;
        END IF;
        
        -- Always create reminder for next year
        INSERT INTO birthday_reminders (user_id, contact_user_id, reminder_date, birthday_date, year)
        VALUES (NEW.user_id, NEW.contact_user_id, birthday_next_year - INTERVAL '1 day', birthday_next_year, next_year)
        ON CONFLICT (user_id, contact_user_id, year) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create birthday reminders when a new contact is added
DROP TRIGGER IF EXISTS create_birthday_reminder_on_contact ON contacts;
CREATE TRIGGER create_birthday_reminder_on_contact
    AFTER INSERT ON contacts
    FOR EACH ROW EXECUTE FUNCTION handle_new_contact_birthday();

-- Function to trigger when a user updates their birthday
CREATE OR REPLACE FUNCTION handle_birthday_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If birthday was added or changed, regenerate all reminders for this user
    IF OLD.birthday IS DISTINCT FROM NEW.birthday AND NEW.birthday IS NOT NULL THEN
        -- Delete existing future reminders for this user
        DELETE FROM birthday_reminders 
        WHERE contact_user_id = NEW.id 
          AND reminder_date > CURRENT_DATE;
        
        -- Regenerate reminders (this will be handled by the generate function or manually)
        -- For now, we'll rely on the periodic generation
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to regenerate reminders when birthday is updated
DROP TRIGGER IF EXISTS regenerate_birthday_reminders ON users;
CREATE TRIGGER regenerate_birthday_reminders
    AFTER UPDATE ON users
    FOR EACH ROW 
    WHEN (OLD.birthday IS DISTINCT FROM NEW.birthday)
    EXECUTE FUNCTION handle_birthday_update();

-- ============================================
-- INITIAL DATA GENERATION
-- ============================================

-- Generate birthday reminders for existing contacts with birthdays
SELECT generate_birthday_reminders();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE 'SUCCESS: New Cinq features have been installed! 🎉';
    RAISE NOTICE 'Features added:';
    RAISE NOTICE '✅ Message Reactions - React with emojis on messages';
    RAISE NOTICE '✅ Conversation Streaks - Track consecutive conversation days';
    RAISE NOTICE '✅ Birthday Reminders - Automatic birthday notifications';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Deploy the updated code to your server';
    RAISE NOTICE '2. The frontend JavaScript will automatically integrate the new features';
    RAISE NOTICE '3. Test the features in your app!';
END $$;