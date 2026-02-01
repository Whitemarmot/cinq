#!/usr/bin/env python3
"""
Lighthouse Optimization: Non-blocking Google Fonts
Replaces blocking font loads with media="print" onload pattern
"""

import re
import os
import glob

PROJECT_DIR = '/home/node/clawd/projects/cinq'

# Pattern to find blocking Google Fonts link
BLOCKING_PATTERN = r'<link href="(https://fonts\.googleapis\.com/css2[^"]+)" rel="stylesheet">'

# Non-blocking replacement with font-display swap and media trick
def get_replacement(match):
    url = match.group(1)
    # Ensure display=swap is in URL
    if 'display=swap' not in url:
        url += '&display=swap'
    return f'''<link rel="stylesheet" href="{url}" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="{url}"></noscript>'''

def optimize_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already optimized
    if 'media="print" onload' in content and 'fonts.googleapis.com' in content:
        return False
    
    new_content = re.sub(BLOCKING_PATTERN, get_replacement, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def main():
    html_files = glob.glob(os.path.join(PROJECT_DIR, '*.html'))
    modified = 0
    
    for filepath in html_files:
        if optimize_file(filepath):
            print(f"✅ Optimized: {os.path.basename(filepath)}")
            modified += 1
        else:
            print(f"⏭️  Already optimized: {os.path.basename(filepath)}")
    
    print(f"\n🎉 Modified {modified} files")

if __name__ == '__main__':
    main()
