# Cinq — L'anti-réseau social

> 5 proches. Pas de likes. Pas d'algorithme. Juste les gens qui comptent vraiment.

## 🚀 Setup

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans SQL Editor
3. Exécuter le contenu de `supabase/schema.sql`
4. Récupérer les clés dans Settings > API

### 2. Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Deploy
cd projects/cinq
vercel

# Configurer les secrets
vercel secrets add supabase-url "https://xxxxx.supabase.co"
vercel secrets add supabase-anon-key "eyJxxxxx"
vercel secrets add supabase-service-key "eyJxxxxx"

# Deployer en prod
vercel --prod
```

### 3. Domaine

1. Dans Vercel > Settings > Domains
2. Ajouter `cinq.app`
3. Configurer les DNS chez ton registrar

## 📁 Structure

```
cinq/
├── index.html          # Landing page
├── api/
│   └── waitlist.js     # API serverless
├── supabase/
│   └── schema.sql      # Schema DB
├── vercel.json         # Config déploiement
└── .env.example        # Variables d'environnement
```

## 🔧 Dev local

```bash
# Installer deps
npm install @supabase/supabase-js

# Lancer en local
npx vercel dev
```

## 📊 Voir les inscrits

Dans Supabase > Table Editor > waitlist

Ou via SQL:
```sql
SELECT * FROM waitlist ORDER BY created_at DESC;
```

## 🎯 Prochaines étapes

- [ ] Acheter domaine cinq.app
- [ ] Setup Supabase
- [ ] Deploy Vercel
- [ ] Ajouter Plausible Analytics
- [ ] Créer compte Twitter @cinq_app
- [ ] Préparer MVP de l'app

---

Made with ⚡ by Kempfr & Damien
