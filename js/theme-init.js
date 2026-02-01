/**
 * CINQ Theme Initialization (Inline Script)
 * 
 * COPY THIS SCRIPT INLINE IN <head> to prevent white flash.
 * This is the minified version for production.
 */

// Minified inline version (copy this into <script> tag in <head>):
// (function(){var h=document.documentElement,s=localStorage.getItem('cinq_theme'),t=s||'dark';if(t==='auto'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'}else if(t==='sunrise'){var c;try{c=JSON.parse(localStorage.getItem('cinq_sunrise_data'))}catch(e){}var sr=c&&c.sunrise||7,ss=c&&c.sunset||19,h=new Date().getHours();t=(h>=sr&&h<ss)?'light':'dark'}h.setAttribute('data-theme',t);h.setAttribute('data-theme-preference',s||'dark');h.classList.add('theme-loading')})();

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
  // Resolve 'sunrise' to actual theme based on time
  else if (preference === 'sunrise') {
    var sunriseData = null;
    try {
      sunriseData = JSON.parse(localStorage.getItem('cinq_sunrise_data'));
    } catch(e) {}
    
    var sunrise = (sunriseData && sunriseData.sunrise) || 7;
    var sunset = (sunriseData && sunriseData.sunset) || 19;
    var now = new Date();
    var currentHour = now.getHours() + now.getMinutes() / 60;
    
    effective = (currentHour >= sunrise && currentHour < sunset) ? 'light' : 'dark';
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
