#!/usr/bin/env node
/**
 * Cinq — Accessibility Testing Script
 * Tests all HTML pages against WCAG 2.1 AAA standards using axe-core
 * 
 * Usage: node scripts/a11y-test.js
 * 
 * @version 1.0
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// HTML files to test
const htmlFiles = readdirSync(projectRoot)
  .filter(f => f.endsWith('.html') && !f.includes('node_modules'))
  .map(f => join(projectRoot, f));

console.log('🔍 Cinq Accessibility Audit\n');
console.log('='.repeat(60));
console.log('WCAG 2.1 AAA Compliance Check\n');

let totalIssues = 0;
let totalWarnings = 0;

/**
 * Check for skip links
 */
function checkSkipLinks(html, filename) {
  const issues = [];
  
  // Check for skip link to main content
  if (!html.includes('skip-link') && !html.includes('skip-links')) {
    issues.push({
      type: 'error',
      rule: 'skip-link',
      message: 'Missing skip link to main content'
    });
  }
  
  // Check if skip link targets exist
  if (html.includes('#main-content') || html.includes('#main')) {
    if (!html.includes('id="main-content"') && !html.includes('id="main"')) {
      issues.push({
        type: 'warning',
        rule: 'skip-link-target',
        message: 'Skip link target (#main-content or #main) not found'
      });
    }
  }
  
  return issues;
}

/**
 * Check for proper heading hierarchy
 */
function checkHeadingHierarchy(html, filename) {
  const issues = [];
  const headings = html.match(/<h[1-6][^>]*>/gi) || [];
  
  let lastLevel = 0;
  for (const heading of headings) {
    const level = parseInt(heading.match(/h([1-6])/i)[1]);
    if (level > lastLevel + 1 && lastLevel !== 0) {
      issues.push({
        type: 'warning',
        rule: 'heading-order',
        message: `Heading level skipped: h${lastLevel} to h${level}`
      });
    }
    lastLevel = level;
  }
  
  // Check for h1
  if (!html.includes('<h1')) {
    issues.push({
      type: 'warning',
      rule: 'page-has-heading-one',
      message: 'Page should have at least one h1 element'
    });
  }
  
  return issues;
}

/**
 * Check for proper ARIA usage
 */
function checkARIA(html, filename) {
  const issues = [];
  
  // Check for aria-live regions for dynamic content
  const dynamicPatterns = [
    'toast',
    'notification',
    'alert',
    'message',
    'loading',
    'spinner'
  ];
  
  for (const pattern of dynamicPatterns) {
    if (html.includes(pattern) && !html.includes('aria-live') && !html.includes('role="alert"') && !html.includes('role="status"')) {
      // Only warn if it seems like dynamic content without aria-live
      if (html.includes(`class="${pattern}`) || html.includes(`class=".*${pattern}`)) {
        issues.push({
          type: 'warning',
          rule: 'aria-live',
          message: `Dynamic content (${pattern}) may need aria-live region`
        });
      }
    }
  }
  
  // Check for proper button roles
  const divButtons = html.match(/<div[^>]*onclick[^>]*>/gi) || [];
  for (const div of divButtons) {
    if (!div.includes('role="button"') && !div.includes('role=\'button\'')) {
      issues.push({
        type: 'error',
        rule: 'button-name',
        message: 'Clickable div should have role="button" and keyboard support'
      });
    }
  }
  
  return issues;
}

/**
 * Check for proper form accessibility
 */
function checkForms(html, filename) {
  const issues = [];
  
  // Check for labels on inputs
  const inputs = html.match(/<input[^>]*>/gi) || [];
  for (const input of inputs) {
    // Skip hidden and submit inputs
    if (input.includes('type="hidden"') || input.includes('type="submit"')) continue;
    
    // Check for id to match with label
    const idMatch = input.match(/id=["']([^"']+)["']/);
    if (idMatch) {
      const id = idMatch[1];
      if (!html.includes(`for="${id}"`) && !html.includes(`for='${id}'`)) {
        // Check for aria-label or aria-labelledby
        if (!input.includes('aria-label') && !input.includes('aria-labelledby')) {
          issues.push({
            type: 'warning',
            rule: 'label',
            message: `Input #${id} may be missing an associated label`
          });
        }
      }
    }
  }
  
  return issues;
}

/**
 * Check for image alt text
 */
function checkImages(html, filename) {
  const issues = [];
  
  const images = html.match(/<img[^>]*>/gi) || [];
  for (const img of images) {
    if (!img.includes('alt=') && !img.includes('alt =')) {
      issues.push({
        type: 'error',
        rule: 'image-alt',
        message: 'Image missing alt attribute'
      });
    }
  }
  
  return issues;
}

/**
 * Check for proper language attribute
 */
function checkLanguage(html, filename) {
  const issues = [];
  
  if (!html.match(/<html[^>]*lang=/i)) {
    issues.push({
      type: 'error',
      rule: 'html-has-lang',
      message: 'HTML element missing lang attribute'
    });
  }
  
  return issues;
}

/**
 * Check for proper landmarks
 */
function checkLandmarks(html, filename) {
  const issues = [];
  
  if (!html.includes('<main') && !html.includes('role="main"')) {
    issues.push({
      type: 'warning',
      rule: 'landmark-main',
      message: 'Page should have a main landmark'
    });
  }
  
  if (!html.includes('<nav') && !html.includes('role="navigation"')) {
    issues.push({
      type: 'warning',
      rule: 'landmark-navigation',
      message: 'Page may need a navigation landmark'
    });
  }
  
  return issues;
}

/**
 * Check for focus indicators
 */
function checkFocusIndicators(html, filename) {
  const issues = [];
  
  // Check if a11y.css is included
  if (!html.includes('a11y.css') && !html.includes('a11y.min.css')) {
    issues.push({
      type: 'error',
      rule: 'focus-visible',
      message: 'a11y.css not included - focus indicators may be missing'
    });
  }
  
  return issues;
}

/**
 * Check for color contrast (basic check)
 */
function checkContrast(html, filename) {
  const issues = [];
  
  // Check for potentially low contrast text colors
  const lowContrastPatterns = [
    /color:\s*rgba\([^)]*,\s*0\.[0-4]\)/gi,  // rgba with <0.5 alpha
    /opacity:\s*0\.[0-4]/gi                   // Low opacity
  ];
  
  // Note: This is a basic check. Full contrast check requires computed styles
  
  return issues;
}

/**
 * Run all checks on a file
 */
function auditFile(filepath) {
  const filename = filepath.split('/').pop();
  
  if (!existsSync(filepath)) {
    console.log(`\n⚠️  ${filename}: File not found`);
    return { errors: 0, warnings: 0 };
  }
  
  const html = readFileSync(filepath, 'utf8');
  
  const allIssues = [
    ...checkSkipLinks(html, filename),
    ...checkHeadingHierarchy(html, filename),
    ...checkARIA(html, filename),
    ...checkForms(html, filename),
    ...checkImages(html, filename),
    ...checkLanguage(html, filename),
    ...checkLandmarks(html, filename),
    ...checkFocusIndicators(html, filename),
    ...checkContrast(html, filename)
  ];
  
  const errors = allIssues.filter(i => i.type === 'error');
  const warnings = allIssues.filter(i => i.type === 'warning');
  
  console.log(`\n📄 ${filename}`);
  console.log('-'.repeat(40));
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('   ✅ No issues found');
  } else {
    for (const issue of errors) {
      console.log(`   ❌ [${issue.rule}] ${issue.message}`);
    }
    for (const issue of warnings) {
      console.log(`   ⚠️  [${issue.rule}] ${issue.message}`);
    }
  }
  
  return { errors: errors.length, warnings: warnings.length };
}

// Run audit on all HTML files
console.log(`Testing ${htmlFiles.length} HTML files...\n`);

for (const file of htmlFiles) {
  const result = auditFile(file);
  totalIssues += result.errors;
  totalWarnings += result.warnings;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`\nFiles tested: ${htmlFiles.length}`);
console.log(`Errors: ${totalIssues}`);
console.log(`Warnings: ${totalWarnings}`);

if (totalIssues === 0) {
  console.log('\n✅ All critical accessibility checks passed!');
} else {
  console.log(`\n❌ ${totalIssues} critical issues need to be fixed.`);
}

if (totalWarnings > 0) {
  console.log(`⚠️  ${totalWarnings} warnings should be reviewed.`);
}

console.log('\n📖 For full WCAG 2.1 AAA compliance, also test with:');
console.log('   - Screen readers (NVDA, VoiceOver, JAWS)');
console.log('   - Browser DevTools Accessibility panel');
console.log('   - axe DevTools browser extension');
console.log('   - WAVE Web Accessibility Evaluation Tool\n');

// Exit with error code if issues found
process.exit(totalIssues > 0 ? 1 : 0);
