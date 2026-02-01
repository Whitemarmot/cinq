# Security Headers

Ce document décrit les headers de sécurité HTTP configurés dans `vercel.json`.

## Headers Configurés

### Content-Security-Policy (CSP)

Contrôle les sources de contenu autorisées pour prévenir les attaques XSS et injection de données.

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://plausible.io https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
connect-src 'self' https://guioxfulihyehrwytxce.supabase.co wss://guioxfulihyehrwytxce.supabase.co https://plausible.io https://*.vercel.app https://*.netlify.app;
img-src 'self' data: https:;
frame-ancestors 'none';
```

| Directive | Description |
|-----------|-------------|
| `default-src 'self'` | Par défaut, autorise uniquement les ressources du même domaine |
| `script-src` | Scripts autorisés : domaine, inline, Tailwind CDN, Plausible, jsDelivr |
| `style-src` | Styles : domaine, inline, Google Fonts |
| `font-src` | Polices : Google Fonts uniquement |
| `connect-src` | Connexions API : Supabase, Plausible, Vercel/Netlify previews |
| `img-src` | Images : domaine, data URIs, tout HTTPS |
| `frame-ancestors 'none'` | Interdit l'intégration dans des iframes |

### X-Frame-Options

```
X-Frame-Options: DENY
```

Empêche l'intégration du site dans des iframes (protection clickjacking). Redondant avec `frame-ancestors 'none'` mais conservé pour compatibilité navigateurs anciens.

### X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

Empêche le navigateur de deviner le type MIME. Force le respect du `Content-Type` déclaré, prévenant les attaques par confusion de type.

### Referrer-Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

Contrôle les informations envoyées dans le header `Referer` :
- **Same-origin** : URL complète
- **Cross-origin HTTPS→HTTPS** : Origine uniquement (domaine)
- **HTTPS→HTTP** : Rien (downgrade bloqué)

### Permissions-Policy

```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Désactive l'accès aux APIs sensibles du navigateur :
- 🎥 `camera=()` — Caméra désactivée
- 🎤 `microphone=()` — Microphone désactivé
- 📍 `geolocation=()` — Géolocalisation désactivée

### Headers Additionnels

#### Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Force HTTPS pendant 1 an pour le domaine et sous-domaines.

#### X-XSS-Protection (Legacy)

```
X-XSS-Protection: 1; mode=block
```

Active le filtre XSS des navigateurs (obsolète mais inoffensif pour vieux navigateurs).

## Headers par Route

| Route | Headers Spécifiques |
|-------|---------------------|
| `/(.*)`| Tous les security headers |
| `/api/*` | `Cache-Control: no-store, no-cache, must-revalidate` |
| `/assets/*` | `Cache-Control: public, max-age=31536000, immutable` |

## Vérification

Tester les headers avec :

```bash
curl -I https://cinq.clawd.sh
```

Ou utiliser [securityheaders.com](https://securityheaders.com/) pour un audit complet.

## Ressources

- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy)
- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)
