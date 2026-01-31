/**
 * CINQ — Hero Particles Effect
 * ============================
 * Orbiting particles around the "5"
 * Creates a mesmerizing, memorable visual
 */

(function() {
  'use strict';

  function initHeroParticles() {
    const five = document.querySelector('.five');
    if (!five) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'hero-particles-canvas';
    canvas.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      height: 400px;
      pointer-events: none;
      z-index: 0;
    `;
    five.style.position = 'relative';
    five.insertBefore(canvas, five.firstChild);

    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 400;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Particles - 5 orbital rings for "5" theme
    const particles = [];
    const orbits = [
      { radius: 90, count: 5, speed: 0.003, size: 3, color: 'rgba(255, 107, 91, 0.8)' },
      { radius: 110, count: 8, speed: -0.002, size: 2, color: 'rgba(255, 138, 125, 0.6)' },
      { radius: 130, count: 13, speed: 0.0015, size: 2, color: 'rgba(255, 179, 153, 0.4)' },
      { radius: 150, count: 21, speed: -0.001, size: 1.5, color: 'rgba(255, 200, 180, 0.3)' },
      { radius: 170, count: 34, speed: 0.0008, size: 1, color: 'rgba(255, 220, 200, 0.2)' }
    ];

    // Create particles for each orbit
    orbits.forEach(orbit => {
      for (let i = 0; i < orbit.count; i++) {
        const angle = (Math.PI * 2 / orbit.count) * i;
        particles.push({
          orbit: orbit.radius,
          angle: angle,
          speed: orbit.speed + (Math.random() - 0.5) * 0.0005,
          size: orbit.size + Math.random() * 0.5,
          color: orbit.color,
          pulse: Math.random() * Math.PI * 2
        });
      }
    });

    // Connection lines between nearby particles
    function drawConnections() {
      ctx.strokeStyle = 'rgba(255, 107, 91, 0.1)';
      ctx.lineWidth = 0.5;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          
          const x1 = centerX + Math.cos(p1.angle) * p1.orbit;
          const y1 = centerY + Math.sin(p1.angle) * p1.orbit;
          const x2 = centerX + Math.cos(p2.angle) * p2.orbit;
          const y2 = centerY + Math.sin(p2.angle) * p2.orbit;
          
          const dist = Math.hypot(x2 - x1, y2 - y1);
          
          if (dist < 40) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      }
    }

    // Pentagon shape in center
    function drawPentagonGlow(time) {
      const size = 100 + Math.sin(time * 0.001) * 5;
      const points = [];
      
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
        points.push({
          x: centerX + Math.cos(angle) * size,
          y: centerY + Math.sin(angle) * size
        });
      }

      // Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
      gradient.addColorStop(0, 'rgba(255, 107, 91, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 107, 91, 0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < 5; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Pentagon outline
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < 5; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 107, 91, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Animation loop
    let animationId;
    function animate(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pentagon glow
      drawPentagonGlow(time);

      // Draw connections
      drawConnections();

      // Update and draw particles
      particles.forEach(p => {
        p.angle += p.speed;
        p.pulse += 0.02;

        const x = centerX + Math.cos(p.angle) * p.orbit;
        const y = centerY + Math.sin(p.angle) * p.orbit;
        const currentSize = p.size + Math.sin(p.pulse) * 0.5;

        // Particle glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentSize * 3);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'rgba(255, 107, 91, 0)');

        ctx.beginPath();
        ctx.arc(x, y, currentSize * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Particle core
        ctx.beginPath();
        ctx.arc(x, y, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    }

    // Start animation
    animate(0);

    // Cleanup on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else {
        animate(0);
      }
    });

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancelAnimationFrame(animationId);
      canvas.remove();
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroParticles);
  } else {
    initHeroParticles();
  }
})();
