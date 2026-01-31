# 🔍 QA Review — index.html

**Date:** 2025-01-31  
**Reviewer:** QA Senior (Subagent)  
**Verdict:** ⚠️ Passable avec corrections critiques appliquées

---

## 🚨 BUGS CRITIQUES (Corrigés)

### 1. UTM Params définis mais jamais utilisés
**Fichier:** `index.html` ligne ~180  
**Problème:** `getUtmParams()` était définie mais jamais appelée lors du submit.  
**Impact:** Perte totale du tracking marketing. Impossible de savoir d'où viennent les inscrits.  
**Fix:** ✅ Appliqué — UTM params maintenant envoyés à Supabase.

### 2. Input email sans label accessible
**Problème:** `<input type="email">` avec uniquement un placeholder.  
**Impact:** Screen readers lisent "edit text" au lieu de "adresse email". WCAG 2.1 fail.  
**Fix:** ✅ Appliqué — Ajout `<label class="sr-only">` + attribut `name` + `autocomplete`.

### 3. Counter sans aria-live
**Problème:** Le compteur animé n'annonce pas ses changements.  
**Impact:** Utilisateurs aveugles ne savent pas que le nombre a changé.  
**Fix:** ✅ Appliqué — Ajout `role="status" aria-live="polite"`.

---

## ❌ PROBLÈMES RESTANTS (Non critiques mais à corriger)

### SEO

| Problème | Sévérité | Recommandation |
|----------|----------|----------------|
| `og-image.png` n'existe pas | 🔴 High | Créer l'image 1200x630px |
| Pas de `<link rel="canonical">` | 🟡 Medium | Ajouter `<link rel="canonical" href="https://cinq.app/">` |
| Pas de structured data JSON-LD | 🟡 Medium | Ajouter schema.org Organization/WebSite |
| Pas de sitemap.xml | 🟢 Low | Créer quand plus de pages |

### Accessibilité

| Problème | Sévérité | Recommandation |
|----------|----------|----------------|
| Emojis sans role="img" | 🟡 Medium | Wrapper: `<span role="img" aria-label="cadeau">🎁</span>` |
| Contraste `text-white/30` | 🟡 Medium | Footer quote à 4.5:1 minimum → `text-white/50` |
| Pas de skip-link | 🟢 Low | Ajouter pour keyboard nav |
| Focus visible insuffisant | 🟡 Medium | Ajouter `focus:ring-2 focus:ring-indigo-400` sur les boutons |

### Code Quality

| Problème | Sévérité | Recommandation |
|----------|----------|----------------|
| Tailwind CDN en prod | 🔴 High | Build avec PostCSS pour prod |
| `console.log` en production | 🟢 Low | Supprimer ou guard avec `if(dev)` |
| Pas de noscript fallback | 🟡 Medium | Ajouter message si JS désactivé |
| Pas de validation email avancée | 🟢 Low | Le `type="email"` suffit pour MVP |

### UX

| Problème | Sévérité | Recommandation |
|----------|----------|----------------|
| Bouton "Rejoindre" pas assez distinct | 🟡 Medium | Considérer style plus visible |
| Pas de feedback visuel loading | 🟢 Low | Spinner ou animation sur submit |

---

## ✅ CE QUI EST BIEN

- **Copy percutant** — "847 amis Facebook... combien t'appelleraient à 3h du mat'" = hook puissant
- **Ton cohérent** — Tutoyé partout, anti-establishment assumé
- **Hierarchy claire** — CTA primaire "Offrir" bien mis en avant vs waitlist secondaire
- **Responsive OK** — Breakpoints `md:` et `sm:` bien utilisés
- **Animation subtile** — Les cercles pulsants ajoutent de la vie sans distraire
- **Formulaire fonctionnel** — Gestion erreurs duplicate email, feedback utilisateur
- **Liens valides** — `gift.html` existe ✅

---

## 📊 SCORE

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| SEO | 6/10 | Bases OK, manque image OG et canonical |
| Accessibilité | 5/10 | Amélioré mais emojis et contraste à revoir |
| Responsive | 8/10 | Solide |
| Copy | 9/10 | Excellent, provocateur, mémorable |
| Code | 6/10 | Tailwind CDN = dette technique |
| Fonctionnel | 8/10 | UTM fix appliqué |

**Score global: 7/10** — Shippable MVP, mais nettoyer avant scaling.

---

## 🎯 PRIORITÉS IMMÉDIATES

1. **Créer `og-image.png`** (1200x630) — Les partages social auront une image cassée sinon
2. **Passer Tailwind en build** — CDN = 300KB+ inutiles
3. **Ajouter canonical** — Évite duplicate content si www vs non-www
4. **Wrapper les emojis** — Quick win accessibilité

---

## 📝 DIFF DES CORRECTIONS APPLIQUÉES

```diff
+ <label for="email" class="sr-only">Adresse email</label>
  <input 
      type="email" 
      id="email"
+     name="email"
      placeholder="ton@email.com" 
      required
+     autocomplete="email"

- <div class="mt-16 text-center">
-     <div class="text-4xl font-bold text-indigo-400" id="counter">0</div>
+ <div class="mt-16 text-center" role="status" aria-live="polite">
+     <div class="text-4xl font-bold text-indigo-400" id="counter" aria-label="Nombre de personnes inscrites">0</div>

+ const utmData = getUtmParams();
  const { data, error } = await db
      .from('waitlist')
-     .insert([{ email: email.toLowerCase().trim() }]);
+     .insert([{ 
+         email: email.toLowerCase().trim(),
+         utm_source: utmData.utm_source,
+         utm_medium: utmData.utm_medium,
+         utm_campaign: utmData.utm_campaign,
+         referrer: utmData.referrer
+     }]);
```

---

*Review effectuée sans pitié. Ship it.* 🚀
