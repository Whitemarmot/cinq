#!/usr/bin/env python3
"""
Lighthouse Optimization: Add preconnect hints for external resources
"""

import re
import os
import glob

PROJECT_DIR = '/home/node/clawd/projects/cinq'

# Find all external domains used in each file
def get_external_domains(content):
    domains = set()
    
    # Find all external URLs
    urls = re.findall(r'(?:src|href)="(https://[^"/]+)', content)
    for url in urls:
        domain = url.rstrip('/')
        # Skip already preconnected domains
        if f'preconnect" href="{domain}"' in content:
            continue
        # Skip data URLs
        if domain.startswith('https://cinq.app'):
            continue
        domains.add(domain)
    
    return domains

def add_preconnects(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    domains = get_external_domains(content)
    if not domains:
        return False
    
    # Build preconnect links
    preconnects = []
    for domain in sorted(domains):
        if 'preconnect" href="' + domain not in content:
            crossorigin = ' crossorigin' if 'gstatic.com' in domain else ''
            preconnects.append(f'    <link rel="preconnect" href="{domain}"{crossorigin}>')
            preconnects.append(f'    <link rel="dns-prefetch" href="{domain}">')
    
    if not preconnects:
        return False
    
    # Insert after first <meta charset...> line
    preconnect_block = '\n'.join(preconnects)
    
    # Find existing preconnect section or insert after viewport meta
    if '<link rel="preconnect"' in content:
        # Add missing preconnects after existing ones
        match = re.search(r'(<link rel="preconnect"[^>]+>(?:\s*<link rel="preconnect"[^>]+>)*)', content)
        if match:
            insert_pos = match.end()
            new_content = content[:insert_pos] + '\n' + preconnect_block + content[insert_pos:]
        else:
            return False
    else:
        # Insert after viewport meta
        match = re.search(r'(<meta name="viewport"[^>]+>)', content)
        if match:
            insert_pos = match.end()
            new_content = content[:insert_pos] + '\n\n    <!-- Preconnect for faster resource loading -->\n' + preconnect_block + content[insert_pos:]
        else:
            return False
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True

def main():
    html_files = glob.glob(os.path.join(PROJECT_DIR, '*.html'))
    modified = 0
    
    for filepath in html_files:
        if add_preconnects(filepath):
            print(f"✅ Added preconnects: {os.path.basename(filepath)}")
            modified += 1
        else:
            print(f"⏭️  No new preconnects needed: {os.path.basename(filepath)}")
    
    print(f"\n🎉 Modified {modified} files")

if __name__ == '__main__':
    main()
