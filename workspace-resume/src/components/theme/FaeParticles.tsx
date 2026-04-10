import { onMount, onCleanup } from "solid-js";

/**
 * Fae sprite particle system for The Witching Hour theme.
 * Spawns small golden-green glowing dots that drift across the window
 * on gentle spiral paths, fading in and out. Purely decorative.
 * Only renders when data-theme="witching-hour" is active.
 */
export function FaeParticles() {
  let canvas: HTMLCanvasElement | undefined;
  let animId: number;
  let particles: Particle[] = [];
  let lastSpawn = 0;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    hue: number; // gold to green range
    spiralPhase: number;
    spiralSpeed: number;
    spiralRadius: number;
  }

  function spawn(w: number, h: number): Particle {
    // Spawn anywhere across the full window — uniform distribution
    const x = Math.random() * w;
    const y = Math.random() * h;

    return {
      x, y,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2, // no directional bias — true wandering
      life: 0,
      maxLife: 200 + Math.random() * 400, // 3-10 seconds at 60fps
      size: 1 + Math.random() * 2.5,
      hue: 38 + Math.random() * 30, // gold (38) to warm green (68)
      spiralPhase: Math.random() * Math.PI * 2,
      spiralSpeed: 0.008 + Math.random() * 0.015,
      spiralRadius: 0.3 + Math.random() * 0.8,
    };
  }

  function animate() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use window dimensions, not offsetWidth — the canvas parent may
    // constrain offsetWidth even though position:fixed should be viewport-sized
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    // Spawn across the full window — moderate density
    const now = performance.now();
    if (now - lastSpawn > 400 + Math.random() * 1200) {
      particles.push(spawn(w, h));
      lastSpawn = now;
      // Occasionally spawn a little cluster (2-4)
      if (Math.random() > 0.6) {
        particles.push(spawn(w, h));
        if (Math.random() > 0.4) particles.push(spawn(w, h));
        if (Math.random() > 0.7) particles.push(spawn(w, h));
      }
    }

    // Update and draw
    particles = particles.filter((p) => {
      p.life++;
      if (p.life > p.maxLife) return false;

      // Spiral motion
      p.spiralPhase += p.spiralSpeed;
      p.x += p.vx + Math.cos(p.spiralPhase) * p.spiralRadius;
      p.y += p.vy + Math.sin(p.spiralPhase) * p.spiralRadius;

      // Off-screen cull
      if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return false;

      // Opacity: fade in, hold, fade out
      const progress = p.life / p.maxLife;
      let alpha: number;
      if (progress < 0.15) alpha = progress / 0.15;
      else if (progress > 0.7) alpha = (1 - progress) / 0.3;
      else alpha = 1;
      alpha *= 0.4; // overall subtlety

      // Draw glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      gradient.addColorStop(0, `hsla(${p.hue}, 80%, 65%, ${alpha})`);
      gradient.addColorStop(0.3, `hsla(${p.hue}, 70%, 55%, ${alpha * 0.5})`);
      gradient.addColorStop(1, `hsla(${p.hue}, 60%, 45%, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Bright core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 80%, ${alpha * 0.8})`;
      ctx.fill();

      return true;
    });

    animId = requestAnimationFrame(animate);
  }

  onMount(() => {
    animId = requestAnimationFrame(animate);
  });

  onCleanup(() => {
    cancelAnimationFrame(animId);
  });

  return (
    <canvas
      ref={canvas}
      class="fae-particles"
      style={{
        position: "fixed",
        inset: "0",
        "pointer-events": "none",
        "z-index": "0",
      }}
    />
  );
}
