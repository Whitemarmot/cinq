#!/usr/bin/env node
/**
 * Build script for Cinq - Minification & Optimization
 * Run: node scripts/build.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Files to minify
const CSS_FILES = [
  'design/styles.css',
  'css/mobile-responsive.css',
  'css/a11y.css',
  'animations.css',
  'styles.css'
];

const JS_FILES = [
  'animations.js',
  'fun.js',
  'analytics.js',
  'pwa-install.js',
  'service-worker.js'
];

console.log('🔧 Building Cinq for production...\n');

// Create dist folder if it doesn't exist
const distDir = path.join(ROOT, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Minify CSS files
console.log('📦 Minifying CSS...');
CSS_FILES.forEach(file => {
  const inputPath = path.join(ROOT, file);
  const outputPath = path.join(ROOT, file.replace('.css', '.min.css'));
  
  if (fs.existsSync(inputPath)) {
    try {
      execSync(`npx csso ${inputPath} -o ${outputPath}`, { cwd: ROOT });
      const originalSize = fs.statSync(inputPath).size;
      const minSize = fs.statSync(outputPath).size;
      const savings = ((1 - minSize / originalSize) * 100).toFixed(1);
      console.log(`  ✓ ${file} → ${path.basename(outputPath)} (${savings}% smaller)`);
    } catch (e) {
      console.log(`  ⚠ ${file} - minification failed`);
    }
  }
});

// Minify JS files
console.log('\n📦 Minifying JS...');
JS_FILES.forEach(file => {
  const inputPath = path.join(ROOT, file);
  const outputPath = path.join(ROOT, file.replace('.js', '.min.js'));
  
  if (fs.existsSync(inputPath)) {
    try {
      execSync(`npx terser ${inputPath} -o ${outputPath} -c -m`, { cwd: ROOT });
      const originalSize = fs.statSync(inputPath).size;
      const minSize = fs.statSync(outputPath).size;
      const savings = ((1 - minSize / originalSize) * 100).toFixed(1);
      console.log(`  ✓ ${file} → ${path.basename(outputPath)} (${savings}% smaller)`);
    } catch (e) {
      console.log(`  ⚠ ${file} - minification failed`);
    }
  }
});

console.log('\n✅ Build complete!');
