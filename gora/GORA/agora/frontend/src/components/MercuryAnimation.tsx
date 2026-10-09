import React, { useEffect, useRef } from 'react';

export default function MercuryAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = 400; // Let's give it a fixed height or let it fill parent
    
    // We'll set the canvas resolution to its actual display size
    const resize = () => {
      if (canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      } else {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: any[] = [];
    const numParticles = 250;
    
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        angle: Math.random() * Math.PI * 2,
        dist: Math.random() * Math.min(width, height) / 3, // For the vortex
        speed: 0.005 + Math.random() * 0.015,
        size: Math.random() * 1.5 + 0.5,
        circleAngle: (i / numParticles) * Math.PI * 2, // Evenly spaced for the circle
      });
    }

    let startTime = Date.now();
    let animationFrameId: number;

    const render = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      
      const cycle = 16; // 16s cycle
      const t = elapsed % cycle;

      let state = 0;
      let phaseProgress = 0;
      if (t < 4) {
        state = 0; // Drifting
        phaseProgress = t / 4;
      } else if (t < 8) {
        state = 1; // Vortex
        phaseProgress = (t - 4) / 4;
      } else if (t < 12) {
        state = 2; // Circle
        phaseProgress = (t - 8) / 4;
      } else {
        state = 3; // Zoom out
        phaseProgress = (t - 12) / 4;
      }

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      let currentScale = 1;
      let opacity = 1;

      // Ease in and out logic
      if (state === 3) {
        const ease = phaseProgress < 0.5 
          ? 4 * phaseProgress * phaseProgress * phaseProgress 
          : 1 - Math.pow(-2 * phaseProgress + 2, 3) / 2;
        currentScale = 1 - (ease * 0.9); // Shrink to 0.1
        opacity = 1 - ease; // Fade out
      } else if (state === 0) {
        const ease = phaseProgress < 0.5 
          ? 4 * phaseProgress * phaseProgress * phaseProgress 
          : 1 - Math.pow(-2 * phaseProgress + 2, 3) / 2;
        currentScale = 0.1 + (ease * 0.9); // Grow back to 1
        opacity = ease; // Fade in
      }

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(currentScale, currentScale);
      ctx.translate(-centerX, -centerY);

      // We'll use a soft white/purple color for the particles
      ctx.fillStyle = `rgba(167, 139, 250, ${opacity * 0.8})`;

      particles.forEach((p, i) => {
        if (state === 0) {
          // 1. Drifting
          // Re-scatter if coming from state 3
          if (phaseProgress < 0.1 && opacity < 0.2) {
            p.x = Math.random() * width;
            p.y = Math.random() * height;
          }
          p.x += p.vx;
          p.y += p.vy;
          
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

        } else if (state === 1) {
          // 2. Vortex
          const dx = p.x - centerX;
          const dy = p.y - centerY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          let currentAngle = Math.atan2(dy, dx);
          
          currentAngle += p.speed * (5 * (1 - currentDist/width)); // Faster closer to center
          
          const targetDist = p.dist;
          const newDist = currentDist + (targetDist - currentDist) * 0.02;
          
          p.x = centerX + Math.cos(currentAngle) * newDist;
          p.y = centerY + Math.sin(currentAngle) * newDist;
          p.angle = currentAngle; // Save for next phase

        } else if (state === 2 || state === 3) {
          // 3. Circle & 4. Zoom Out
          const circleRadius = 120; // Fixed radius for the circle
          
          // Gradually shift their angle to their target circle slot
          const angleDiff = p.circleAngle - p.angle;
          p.angle += p.speed; 
          p.circleAngle += p.speed; // Entire circle rotates

          const targetX = centerX + Math.cos(p.circleAngle) * circleRadius;
          const targetY = centerY + Math.sin(p.circleAngle) * circleRadius;
          
          p.x += (targetX - p.x) * 0.05;
          p.y += (targetY - p.y) * 0.05;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full pointer-events-none mix-blend-screen z-0"
    />
  );
}
