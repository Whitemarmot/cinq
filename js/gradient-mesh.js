/**
 * CINQ — Animated Gradient Mesh Background
 * ========================================
 * Organic, flowing gradients like mesh gradients
 * Creates depth and visual interest
 */

(function() {
  'use strict';

  function initGradientMesh() {
    // Create the gradient mesh container
    const mesh = document.createElement('div');
    mesh.className = 'gradient-mesh';
    mesh.innerHTML = `
      <div class="mesh-blob mesh-blob-1"></div>
      <div class="mesh-blob mesh-blob-2"></div>
      <div class="mesh-blob mesh-blob-3"></div>
      <div class="mesh-blob mesh-blob-4"></div>
      <div class="mesh-blob mesh-blob-5"></div>
    `;
    
    // Insert at the beginning of body
    document.body.insertBefore(mesh, document.body.firstChild);
    
    // Add styles
    const style = document.createElement('style');
    style.id = 'gradient-mesh-styles';
    style.textContent = `
      .gradient-mesh {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -2;
        overflow: hidden;
        opacity: 0.6;
      }
      
      /* Light theme - warm coral/peach tones */
      .mesh-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        mix-blend-mode: normal;
        animation: blobFloat 20s ease-in-out infinite;
      }
      
      .mesh-blob-1 {
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(255, 107, 91, 0.4) 0%, transparent 70%);
        top: -10%;
        right: -10%;
        animation-delay: 0s;
        animation-duration: 25s;
      }
      
      .mesh-blob-2 {
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(255, 179, 153, 0.3) 0%, transparent 70%);
        bottom: 20%;
        left: -5%;
        animation-delay: -5s;
        animation-duration: 20s;
      }
      
      .mesh-blob-3 {
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(255, 138, 125, 0.3) 0%, transparent 70%);
        top: 40%;
        right: 20%;
        animation-delay: -10s;
        animation-duration: 22s;
      }
      
      .mesh-blob-4 {
        width: 350px;
        height: 350px;
        background: radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, transparent 70%);
        bottom: -5%;
        right: 30%;
        animation-delay: -15s;
        animation-duration: 28s;
      }
      
      .mesh-blob-5 {
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%);
        top: 60%;
        left: 40%;
        animation-delay: -8s;
        animation-duration: 24s;
      }
      
      @keyframes blobFloat {
        0%, 100% {
          transform: translate(0, 0) scale(1);
        }
        25% {
          transform: translate(30px, -40px) scale(1.05);
        }
        50% {
          transform: translate(-20px, 20px) scale(0.95);
        }
        75% {
          transform: translate(40px, 30px) scale(1.02);
        }
      }
      
      /* ===== DARK MODE - Dramatic neon vibes ===== */
      [data-theme="dark"] .gradient-mesh {
        opacity: 0.8;
      }
      
      [data-theme="dark"] .mesh-blob-1 {
        background: radial-gradient(circle, rgba(255, 107, 91, 0.5) 0%, transparent 70%);
        filter: blur(100px);
      }
      
      [data-theme="dark"] .mesh-blob-2 {
        background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
        filter: blur(120px);
      }
      
      [data-theme="dark"] .mesh-blob-3 {
        background: radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, transparent 70%);
        filter: blur(90px);
      }
      
      [data-theme="dark"] .mesh-blob-4 {
        background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%);
        filter: blur(100px);
      }
      
      [data-theme="dark"] .mesh-blob-5 {
        background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
        filter: blur(80px);
      }
      
      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .mesh-blob {
          animation: none;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Optional: Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    
    document.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 30;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 30;
    });
    
    function animateBlobs() {
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      
      const blobs = document.querySelectorAll('.mesh-blob');
      blobs.forEach((blob, i) => {
        const factor = (i + 1) * 0.3;
        const additionalX = targetX * factor;
        const additionalY = targetY * factor;
        blob.style.transform = `translate(${additionalX}px, ${additionalY}px)`;
      });
      
      requestAnimationFrame(animateBlobs);
    }
    
    // Only enable mouse interaction on desktop
    if (window.matchMedia('(hover: hover)').matches) {
      animateBlobs();
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGradientMesh);
  } else {
    initGradientMesh();
  }
})();
