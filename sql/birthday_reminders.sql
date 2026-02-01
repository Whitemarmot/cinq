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