# Supabase Migrations

## Pending Migration: 005_user_profile_fields.sql

⚠️ **Cette migration est REQUISE pour que la sauvegarde de profil fonctionne !**

### Problème
Les colonnes `display_name`, `bio`, `avatar_url`, `updated_at` n'existent pas dans la table `users`.

### Solution
1. Ouvrir le [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/guioxfulihyehrwytxce/sql)
2. Copier-coller le SQL ci-dessous
3. Cliquer "Run"

### SQL à exécuter

```sql
-- Migration 005: Add profile fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Optional: Add constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'users_display_name_length'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_display_name_length 
        CHECK (char_length(display_name) <= 50);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'users_bio_length'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_bio_length 
        CHECK (char_length(bio) <= 500);
    END IF;
END $$;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public';
```

### Vérification
Après avoir exécuté, relancez cette commande pour vérifier :
```bash
curl -s "https://guioxfulihyehrwytxce.supabase.co/rest/v1/users?select=id,display_name,bio&limit=1" \
  -H "apikey: YOUR_SERVICE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

Vous devriez voir les champs `display_name` et `bio` (potentiellement `null`).
