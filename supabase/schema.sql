-- Cinq Waitlist Schema

-- Table waitlist
CREATE TABLE waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
);

-- Index pour recherche rapide
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_created ON waitlist(created_at DESC);

-- Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Politique: insert public (pour le formulaire)
CREATE POLICY "Allow public insert" ON waitlist
    FOR INSERT WITH CHECK (true);

-- Politique: select uniquement pour service role
CREATE POLICY "Allow service select" ON waitlist
    FOR SELECT USING (auth.role() = 'service_role');

-- Vue pour le compteur public (pas les emails)
CREATE VIEW waitlist_count AS
SELECT COUNT(*) as count FROM waitlist;

-- Fonction pour obtenir le compte
CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM waitlist;
$$ LANGUAGE SQL SECURITY DEFINER;
