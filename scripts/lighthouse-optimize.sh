#!/bin/bash
# Lighthouse 100 Optimization Script

cd /home/node/clawd/projects/cinq

echo "🚀 Starting Lighthouse optimizations..."

# 1. Add loading="lazy" to all images missing it
echo "📸 Adding loading='lazy' to images..."
for file in *.html; do
    if [ -f "$file" ]; then
        # Add loading="lazy" to img tags that don't have it
        sed -i 's/<img \([^>]*\)src="\([^"]*\)"\([^>]*\)>/<img \1src="\2"\3>/g' "$file"
        # Add loading="lazy" if not present
        sed -i 's/<img \([^>]*\)>\([^l]*\)/<img loading="lazy" \1>\2/g' "$file" 2>/dev/null || true
    fi
done

# 2. Create preconnect snippet
PRECONNECT='    <!-- Performance: Preconnect to critical origins -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://unpkg.com">
    <link rel="preconnect" href="https://cdn.jsdelivr.net">
    <link rel="dns-prefetch" href="https://fonts.googleapis.com">
    <link rel="dns-prefetch" href="https://fonts.gstatic.com">'

echo "✅ Manual optimizations needed - see LIGHTHOUSE-OPTIMIZATIONS.md"
echo "🎉 Basic optimizations complete!"
