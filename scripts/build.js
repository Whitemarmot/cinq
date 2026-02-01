#!/usr/bin/env node
/**
 * Build script for Cinq - Minification & Optimization
 * Uses esbuild for fast CSS/JS minification
 * Run: npm run build
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Files to minify
const CSS_FILES = [
  'design/styles.css',
  'css/mobile-responsive.css',
  'css/a11y.css',
  'animations.css',
  'styles.css',
  'css/base.css',
  'css/components.css',
  'css/utilities.css'
];

const JS_FILES = [
  'animations.js',
  'fun.js',
  'analytics.js',
  'pwa-install.js',
  'js/confetti.js',
  'js/easter-eggs.js'
];

console.log('🔧 Building Cinq for production...\n');

let totalSaved = 0;

// Minify CSS files with esbuild
console.log('📦 Minifying CSS with esbuild...');
CSS_FILES.forEach(file => {
  const inputPath = path.join(ROOT, file);
  const outputPath = path.join(ROOT, file.replace('.css', '.min.css'));
  
  if (fs.existsSync(inputPath)) {
    try {
      execSync(`npx esbuild "${inputPath}" --minify --outfile="${outputPath}"`, { 
        cwd: ROOT,
        stdio: 'pipe' 
      });
      const originalSize = fs.statSync(inputPath).size;
      const minSize = fs.statSync(outputPath).size;
      const savings = ((1 - minSize / originalSize) * 100).toFixed(1);
      totalSaved += originalSize - minSize;
      console.log(`  ✓ ${file} (${(originalSize/1024).toFixed(1)}KB → ${(minSize/1024).toFixed(1)}KB, -${savings}%)`);
    } catch (e) {
      console.log(`  ⚠ ${file} - skipped (file error)`);
    }
  }
});

// Minify JS files with terser (better compression than esbuild for JS)
console.log('\n📦 Minifying JS with terser...');
JS_FILES.forEach(file => {
  const inputPath = path.join(ROOT, file);
  const outputPath = path.join(ROOT, file.replace('.js', '.min.js'));
  
  if (fs.existsSync(inputPath)) {
    try {
      execSync(`npx terser "${inputPath}" -o "${outputPath}" -c -m`, { 
        cwd: ROOT,
        stdio: 'pipe' 
      });
      const originalSize = fs.statSync(inputPath).size;
      const minSize = fs.statSync(outputPath).size;
      const savings = ((1 - minSize / originalSize) * 100).toFixed(1);
      totalSaved += originalSize - minSize;
      console.log(`  ✓ ${file} (${(originalSize/1024).toFixed(1)}KB → ${(minSize/1024).toFixed(1)}KB, -${savings}%)`);
    } catch (e) {
      console.log(`  ⚠ ${file} - skipped (file error)`);
    }
  }
});

console.log(`\n✅ Build complete! Total savings: ${(totalSaved/1024).toFixed(1)}KB`);
