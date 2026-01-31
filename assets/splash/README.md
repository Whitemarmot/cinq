# Apple Splash Screens

Pour une expérience PWA optimale sur iOS, il faut générer des splash screens pour chaque taille d'écran.

## Tailles nécessaires

### iPhone
| Appareil | Taille | Retina |
|----------|--------|--------|
| iPhone 15 Pro Max | 1290x2796 | 3x |
| iPhone 15 Pro / 14 Pro | 1179x2556 | 3x |
| iPhone 15/14/13/12 | 1170x2532 | 3x |
| iPhone 14 Plus / 13 Pro Max | 1284x2778 | 3x |
| iPhone SE (3rd gen) | 750x1334 | 2x |
| iPhone 8/7/6s | 750x1334 | 2x |
| iPhone 8 Plus | 1242x2208 | 3x |

### iPad
| Appareil | Taille | Retina |
|----------|--------|--------|
| iPad Pro 12.9" | 2048x2732 | 2x |
| iPad Pro 11" | 1668x2388 | 2x |
| iPad Air / 10.9" | 1640x2360 | 2x |
| iPad 10.2" | 1620x2160 | 2x |
| iPad Mini | 1488x2266 | 2x |

## Comment générer

```bash
# Avec ImageMagick ou sharp
# Créer un SVG/PNG avec le logo centré sur fond #0a0a0b
# Puis redimensionner pour chaque taille
```

## Format du nom de fichier

```
splash-{width}x{height}.png
```

Exemple: `splash-1170x2532.png`

## Meta tags à ajouter dans le HTML

```html
<link rel="apple-touch-startup-image" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/assets/splash/splash-1179x2556.png">
```

Voir la documentation Apple pour les media queries exactes.
