#!/usr/bin/env node
/**
 * Performance Audit Script for Cinq
 * Analyzes and optimizes for Lighthouse score > 90
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

console.log('🔍 CINQ PERFORMANCE AUDIT');
console.log('========================\n');

let totalSavings = 0;
let optimizationsApplied = [];

// 1. Analyze file sizes
console.log('📊 ANALYZING FILE SIZES...\n');

function analyzeFiles(pattern, description) {
    try {
        const output = execSync(`find ${ROOT} -name "${pattern}" ! -path "*/node_modules/*" | xargs ls -lah 2>/dev/null || true`, 
            { encoding: 'utf8' }).trim();
        
        if (output) {
            console.log(`${description}:`);
            console.log(output);
            
            // Calculate total size
            const lines = output.split('\n').filter(line => line.includes('-rw'));
            let totalSize = 0;
            lines.forEach(line => {
                const sizeMatch = line.match(/(\d+(?:\.\d+)?[KMG]?)\s/);
                if (sizeMatch) {
                    let size = parseFloat(sizeMatch[1]);
                    if (sizeMatch[1].includes('K')) size *= 1024;
                    else if (sizeMatch[1].includes('M')) size *= 1024 * 1024;
                    totalSize += size;
                }
            });
            console.log(`Total: ${(totalSize / 1024).toFixed(1)}KB\n`);
        }
    } catch (e) {
        console.log(`${description}: No files found\n`);
    }
}

analyzeFiles('*.css', 'CSS Files');
analyzeFiles('*.js', 'JavaScript Files');
analyzeFiles('*.png', 'PNG Images');
analyzeFiles('*.jpg', 'JPEG Images');
analyzeFiles('*.svg', 'SVG Images');

// 2. Optimize PNG images with pngquant
console.log('🖼️  OPTIMIZING IMAGES...\n');

try {
    // Check if pngquant is available
    execSync('which pngquant', { stdio: 'ignore' });
    
    const pngFiles = execSync(`find ${ROOT}/assets -name "*.png"`, { encoding: 'utf8' })
        .trim().split('\n').filter(f => f);
    
    for (const file of pngFiles) {
        if (!fs.existsSync(file)) continue;
        
        const originalSize = fs.statSync(file).size;
        const backupFile = file + '.backup';
        
        try {
            // Create backup
            fs.copyFileSync(file, backupFile);
            
            // Optimize with pngquant
            execSync(`pngquant --force --ext .png --quality=65-80 "${file}"`, { stdio: 'ignore' });
            
            const newSize = fs.statSync(file).size;
            const savings = originalSize - newSize;
            totalSavings += savings;
            
            if (savings > 0) {
                const savingsPercent = ((1 - newSize / originalSize) * 100).toFixed(1);
                console.log(`✓ ${path.relative(ROOT, file)} (${(originalSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB, -${savingsPercent}%)`);
                optimizationsApplied.push(`PNG optimization: ${path.basename(file)}`);
            } else {
                // Restore backup if no savings
                fs.copyFileSync(backupFile, file);
            }
            
            // Remove backup
            fs.unlinkSync(backupFile);
            
        } catch (e) {
            // Restore backup on error
            if (fs.existsSync(backupFile)) {
                fs.copyFileSync(backupFile, file);
                fs.unlinkSync(backupFile);
            }
            console.log(`⚠ ${path.basename(file)} - optimization failed`);
        }
    }
} catch (e) {
    console.log('📝 pngquant not found - install with: apt-get install pngquant');
    console.log('   PNG optimization skipped\n');
}

// 3. Create optimized critical CSS
console.log('⚡ OPTIMIZING CRITICAL CSS...\n');

const criticalCssPath = path.join(ROOT, 'css', 'critical.css');
if (fs.existsSync(criticalCssPath)) {
    try {
        // Read current critical CSS
        let criticalCss = fs.readFileSync(criticalCssPath, 'utf8');
        
        // Add more critical styles from other files
        const baseCss = path.join(ROOT, 'css', 'base.min.css');
        const themeCss = path.join(ROOT, 'css', 'theme.min.css');
        
        if (fs.existsSync(baseCss)) {
            const baseStyles = fs.readFileSync(baseCss, 'utf8');
            criticalCss += '\n/* Base styles */\n' + baseStyles;
        }
        
        // Minify the combined critical CSS
        const tempFile = '/tmp/critical-combined.css';
        fs.writeFileSync(tempFile, criticalCss);
        
        execSync(`npx esbuild "${tempFile}" --minify --outfile="${criticalCssPath.replace('.css', '.min.css')}"`, 
            { stdio: 'ignore' });
        
        fs.unlinkSync(tempFile);
        
        console.log('✓ Critical CSS optimized');
        optimizationsApplied.push('Enhanced critical CSS');
        
    } catch (e) {
        console.log('⚠ Critical CSS optimization failed');
    }
} else {
    console.log('⚠ Critical CSS file not found');
}

// 4. Generate cache headers configuration
console.log('\n📄 GENERATING CACHE HEADERS...\n');

const cacheHeaders = `
# Netlify Cache Headers Configuration
# Add this to netlify.toml

[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    
[[headers]]
  for = "*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    
[[headers]]
  for = "*.png"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    
[[headers]]
  for = "*.svg"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    
[[headers]]
  for = "*.ico"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    
[[headers]]
  for = "*.woff2"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    
[[headers]]
  for = "*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
`;

fs.writeFileSync(path.join(ROOT, 'cache-headers.txt'), cacheHeaders.trim());
console.log('✓ Cache headers configuration saved to cache-headers.txt');
optimizationsApplied.push('Cache headers configuration');

// 5. Create resource hints for critical resources
console.log('\n🔗 OPTIMIZING RESOURCE HINTS...\n');

const resourceHints = `
<!-- Enhanced Resource Hints for Performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="/css/critical.min.css" as="style">
<link rel="preload" href="/favicon.svg" as="image" type="image/svg+xml">
<link rel="preload" href="/js/theme-init.js" as="script">
<link rel="dns-prefetch" href="https://api.supabase.co">
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
`;

fs.writeFileSync(path.join(ROOT, 'resource-hints.html'), resourceHints.trim());
console.log('✓ Resource hints template saved');
optimizationsApplied.push('Enhanced resource hints');

// 6. Audit JavaScript bundle sizes and suggest optimizations
console.log('\n📦 ANALYZING JAVASCRIPT BUNDLES...\n');

const largeJsFiles = [];
const jsDir = path.join(ROOT, 'js');
if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));
    
    for (const file of jsFiles) {
        const filepath = path.join(jsDir, file);
        const size = fs.statSync(filepath).size;
        const sizeKB = size / 1024;
        
        if (sizeKB > 20) {
            largeJsFiles.push({ file, sizeKB: sizeKB.toFixed(1) });
        }
    }
    
    if (largeJsFiles.length > 0) {
        console.log('⚠ Large JavaScript files found:');
        largeJsFiles.forEach(({ file, sizeKB }) => {
            console.log(`  ${file}: ${sizeKB}KB`);
        });
        console.log('\nConsider code splitting for files > 20KB\n');
    } else {
        console.log('✓ All JavaScript files are reasonably sized\n');
    }
}

// 7. Check for unused CSS
console.log('🧹 ANALYZING CSS USAGE...\n');

try {
    // This is a simplified check - in production, use tools like PurgeCSS
    const htmlFiles = execSync(`find ${ROOT} -name "*.html" ! -path "*/node_modules/*"`, 
        { encoding: 'utf8' }).trim().split('\n').filter(f => f);
    
    console.log(`Found ${htmlFiles.length} HTML files to analyze`);
    
    // Basic analysis - count CSS classes used
    const usedClasses = new Set();
    for (const htmlFile of htmlFiles) {
        if (!fs.existsSync(htmlFile)) continue;
        const content = fs.readFileSync(htmlFile, 'utf8');
        const classMatches = content.match(/class="([^"]+)"/g);
        if (classMatches) {
            classMatches.forEach(match => {
                const classes = match.replace('class="', '').replace('"', '').split(' ');
                classes.forEach(cls => usedClasses.add(cls));
            });
        }
    }
    
    console.log(`✓ Found ${usedClasses.size} CSS classes in use`);
    optimizationsApplied.push('CSS usage analysis completed');
    
} catch (e) {
    console.log('⚠ CSS usage analysis failed');
}

// Summary
console.log('\n📋 OPTIMIZATION SUMMARY');
console.log('======================\n');

console.log('Applied optimizations:');
optimizationsApplied.forEach((opt, i) => {
    console.log(`${i + 1}. ${opt}`);
});

if (totalSavings > 0) {
    console.log(`\nTotal file size savings: ${(totalSavings / 1024).toFixed(1)}KB`);
}

console.log('\n📝 NEXT STEPS:');
console.log('1. Add cache headers from cache-headers.txt to netlify.toml');
console.log('2. Add resource hints from resource-hints.html to <head> tags');
console.log('3. Run Lighthouse test: npm run lighthouse');
console.log('4. Consider implementing lazy loading for non-critical JavaScript');
console.log('5. Enable Brotli compression on your hosting provider');

console.log('\n✅ Performance audit complete!');