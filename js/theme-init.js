/**
 * CINQ Theme Initialization (Inline Script)
 * 
 * COPY THIS SCRIPT INLINE IN <head> to prevent white flash.
 * This is the minified version for production.
 */

// Minified inline version (copy this into <script> tag in <head>):
// (function(){var h=document.documentElement,s=localStorage.getItem('cinq_theme'),t=s||'dark';if(t==='auto'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'}h.setAttribute('data-theme',t);h.setAttribute('data-theme-preference',s||'dark');h.classList.add('theme-loading')})();

// Full readable version:
(function() {
  var html = document.documentElement;
  var saved = null;
  
  try {
    saved = localStorage.getItem('cinq_theme');
  } catch(e) {}
  
  var preference = saved || 'dark';
  var effective = preference;
  
  // Resolve 'auto' to actual theme
  if (preference === 'auto') {
    effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) 
      ? 'light' 
      : 'dark';
  }
  
  // Apply theme immediately
  html.setAttribute('data-theme', effective);
  html.setAttribute('data-theme-preference', preference);
  
  // Add loading class to prevent transitions during initial render
  html.classList.add('theme-loading');
  
  // Update theme-color meta
  var meta = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', effective === 'light' ? '#faf9f7' : '#0e0e12');
  }
})();
