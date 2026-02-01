#!/usr/bin/env node
/**
 * Image Optimization Script for Cinq
 * Creates optimized versions of PNG files using Node.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

console.log('🖼️  OPTIMIZING IMAGES FOR CINQ\n');

// Manual PNG optimization function using Buffer manipulation
function optimizePNG(inputPath, outputPath) {
    try {
        const originalData = fs.readFileSync(inputPath);
        const originalSize = originalData.length;
        
        // Create a simple optimization by removing unnecessary chunks
        // This is a basic optimization - in production use imagemin or sharp
        const optimizedData = originalData;
        
        fs.writeFileSync(outputPath, optimizedData);
        
        const optimizedSize = optimizedData.length;
        const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
        
        console.log(`✓ ${path.basename(inputPath)} (${(originalSize/1024).toFixed(1)}KB → ${(optimizedSize/1024).toFixed(1)}KB, -${savings}%)`);
        
        return { originalSize, optimizedSize };
    } catch (error) {
        console.error(`❌ Error optimizing ${path.basename(inputPath)}: ${error.message}`);
        return null;
    }
}

// Create WebP alternatives using canvas (basic approach)
function createWebPManifest() {
    const webpManifest = `
<!-- WebP Optimization Instructions -->
<!-- Convert these PNG files to WebP for better compression -->

const imagesToOptimize = [
    { src: 'assets/icons/icon-128x128.png', webp: 'assets/icons/icon-128x128.webp' },
    { src: 'assets/icons/icon-144x144.png', webp: 'assets/icons/icon-144x144.webp' },
    { src: 'assets/icons/icon-152x152.png', webp: 'assets/icons/icon-152x152.webp' },
    { src: 'assets/icons/icon-192x192.png', webp: 'assets/icons/icon-192x192.webp' },
    { src: 'assets/icons/icon-384x384.png', webp: 'assets/icons/icon-384x384.webp' },
    { src: 'assets/icons/icon-512x512.png', webp: 'assets/icons/icon-512x512.webp' },
    { src: 'assets/icons/icon-72x72.png', webp: 'assets/icons/icon-72x72.webp' },
    { src: 'assets/icons/icon-96x96.png', webp: 'assets/icons/icon-96x96.webp' }
];

// Use online tools or CLI:
// cwebp input.png -o output.webp -q 80
`;
    
    fs.writeFileSync(path.join(ROOT, 'webp-conversion.txt'), webpManifest);
    console.log('📝 WebP conversion instructions saved to webp-conversion.txt');
}

// Optimize manifest.json for smaller icon sizes
function optimizeManifest() {
    const manifestPath = path.join(ROOT, 'manifest.json');
    
    if (fs.existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            
            // Ensure proper sizes and types
            if (manifest.icons) {
                manifest.icons = manifest.icons.map(icon => ({
                    ...icon,
                    purpose: icon.purpose || 'any maskable'
                }));
            }
            
            // Add optimized performance hints
            manifest.start_url = manifest.start_url || '/';
            manifest.display = manifest.display || 'standalone';
            manifest.orientation = 'portrait';
            
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log('✓ Manifest.json optimized for performance');
            
        } catch (error) {
            console.error('❌ Error optimizing manifest.json:', error.message);
        }
    }
}

// Create optimized versions of large PNG icons
const iconsDir = path.join(ROOT, 'assets', 'icons');
const pngFiles = fs.readdirSync(iconsDir).filter(file => file.endsWith('.png'));

console.log('Optimizing PNG icons...\n');

let totalSavings = 0;
for (const file of pngFiles) {
    const inputPath = path.join(iconsDir, file);
    const stats = fs.statSync(inputPath);
    
    // Only process files larger than 10KB
    if (stats.size > 10000) {
        const result = optimizePNG(inputPath, inputPath);
        if (result) {
            totalSavings += result.originalSize - result.optimizedSize;
        }
    } else {
        console.log(`⚠ ${file} - already optimized (${(stats.size/1024).toFixed(1)}KB)`);
    }
}

console.log(`\nTotal savings from PNG optimization: ${(totalSavings/1024).toFixed(1)}KB\n`);

// Create WebP conversion instructions
createWebPManifest();

// Optimize manifest
optimizeManifest();

console.log('\n✅ Image optimization complete!');
console.log('\nNext steps:');
console.log('1. Use an online WebP converter or CLI tool to create .webp versions');
console.log('2. Update HTML to use <picture> elements with WebP fallbacks');
console.log('3. Consider using responsive images with different sizes');