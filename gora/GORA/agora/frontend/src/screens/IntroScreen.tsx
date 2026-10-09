import React, { useEffect, useRef, useState } from 'react';

interface IntroScreenProps {
  onMenuReady: (isReady: boolean) => void;
  onCategorySelect: (index: number) => void;
  activeCategoryIndex: number;
  dimMenu?: boolean;
}

export default function IntroScreen({ onMenuReady, onCategorySelect, activeCategoryIndex, dimMenu = false }: IntroScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const hasFiredReady = useRef(false);
  
  // Refs for the 6 category labels in the DOM
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    const startTime = Date.now();

    const numRings = 15;
    const pointsPerRing = 36;
    const innerRadius = 250;
    const outerRadius = 550;
    const tiltAngle = Math.PI / 6; 
    const cosT = Math.cos(tiltAngle);
    const sinT = Math.sin(tiltAngle);
    const focalLength = 1000;
    const baseCameraZ = 800;

    // Initialize particles for deterministic drifting
    const particles: any[] = [];
    for (let rIndex = 0; rIndex < numRings; rIndex++) {
      for (let pIndex = 0; pIndex < pointsPerRing; pIndex++) {
        // Random starting position for drifting phase (spread wide)
        const startX = (Math.random() - 0.5) * width * 4;
        const startY = (Math.random() - 0.5) * height * 4;
        const startZ = (Math.random() - 0.5) * focalLength * 3;
        
        // Define the 5 menu categories evenly distributed along the linear index
        let isCategory = false;
        let categoryLabel = "";
        let categoryIndex = -1;
        
        const linearIndex = rIndex * pointsPerRing + pIndex;
        const totalPoints = numRings * pointsPerRing;
        
        if (linearIndex === 0) { isCategory = true; categoryLabel = "1 · Organization"; categoryIndex = 0; }
        else if (linearIndex === Math.floor((totalPoints - 1) * 0.20)) { isCategory = true; categoryLabel = "2 · Appoint"; categoryIndex = 1; }
        else if (linearIndex === Math.floor((totalPoints - 1) * 0.40)) { isCategory = true; categoryLabel = "3 · My Role"; categoryIndex = 2; }
        else if (linearIndex === Math.floor((totalPoints - 1) * 0.60)) { isCategory = true; categoryLabel = "4 · Sign"; categoryIndex = 3; }
        else if (linearIndex === Math.floor((totalPoints - 1) * 0.80)) { isCategory = true; categoryLabel = "5 · The Challenge"; categoryIndex = 4; }
        else if (linearIndex === totalPoints - 1) { isCategory = true; categoryLabel = "0 · How to Use"; categoryIndex = 5; }
        
        particles.push({
          rIndex,
          pIndex,
          startX,
          startY,
          startZ,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          speedZ: (Math.random() - 0.5) * 0.5,
          ampX: Math.random() * 200,
          ampY: Math.random() * 200,
          ampZ: Math.random() * 200,
          isHighlight: Math.random() < 0.1,
          isCategory,
          categoryLabel,
          categoryIndex
        });
      }
    }

    let smoothScroll = 0;

    const render = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // seconds

      // Calculate scroll progress [0, 1]
      const maxScroll = (containerRef.current?.scrollHeight || window.innerHeight) - window.innerHeight;
      const targetScroll = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      
      // Smooth the scroll slightly so it feels fluid even with a choppy mouse wheel
      smoothScroll += (targetScroll - smoothScroll) * 0.1;

      // Map smoothScroll to phases
      // Auto assembly based on time
      const assembleProgress = Math.min(1, elapsed * 0.4); // Finishes in 2.5s
      const easeAssemble = 1 - Math.pow(1 - assembleProgress, 3);
      
      // Morph directly from Ring to Line using scroll
      const easeMorph = 1 - Math.pow(1 - smoothScroll, 3);

      ctx.clearRect(0, 0, width, height);

      // --- Professional dynamic background ---
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      const interpolateColor = (start: number[], end: number[], progress: number) => {
        const r = Math.round(start[0] + (end[0] - start[0]) * progress);
        const g = Math.round(start[1] + (end[1] - start[1]) * progress);
        const b = Math.round(start[2] + (end[2] - start[2]) * progress);
        return `rgb(${r}, ${g}, ${b})`;
      };
      
      // Start: Top #050810, Bottom #0a0f1a (deep, professional tech midnight blue)
      const topStart = [5, 8, 16];   
      const topEnd = [0, 0, 0];        // #000000
      const bottomStart = [10, 15, 26];
      const bottomEnd = [3, 5, 10];    // #03050a
      
      bgGradient.addColorStop(0, interpolateColor(topStart, topEnd, smoothScroll));
      bgGradient.addColorStop(1, interpolateColor(bottomStart, bottomEnd, smoothScroll));
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const time = elapsed * 0.15; 
      // Dim the whole canvas when user scrolls down the content
      const targetGlobalAlpha = dimMenu ? 0.3 : 1;
      ctx.globalAlpha += (targetGlobalAlpha - ctx.globalAlpha) * 0.1;
      if (isNaN(ctx.globalAlpha)) ctx.globalAlpha = 1;
      
      // Camera moves slightly closer during morph
      const cameraZ = baseCameraZ + easeMorph * 100;

      const projectedPoints: any[][] = Array(numRings).fill(0).map(() => []);

      particles.forEach(p => {
        const { rIndex, pIndex } = p;
        // --- 1. Target Ring positions ---
        // A thick, elegant data ring (like a halo)
        const r = innerRadius + (rIndex / (numRings - 1)) * (outerRadius - innerRadius);
        const ringAngle = (pIndex / pointsPerRing) * Math.PI * 2 + time * 0.5;
        const targetX = r * Math.cos(ringAngle);
        const targetZ = r * Math.sin(ringAngle);
        // Slight pseudo-random thickness for the ring to give it volume
        const targetY = Math.sin(rIndex * 13 + pIndex * 7) * 20;

        const totalPoints = numRings * pointsPerRing;
        const linearIndex = rIndex * pointsPerRing + pIndex;
        const normalizedP = linearIndex / (totalPoints - 1);
        
        // --- 2. Recap Line positions ---
        // Flat horizontal line at the top of the screen
        const rX = (normalizedP - 0.5) * (width * 0.85);
        
        // Calculate rY so that the projected Y (projY) is exactly 64px from the top
        // At easeMorph=1, z1=0, cameraZ=900, depth=1900, scale = 1000/1900
        const finalScale = 1000 / 1900;
        const targetProjY = 64;
        const rY = (targetProjY - height / 2) / finalScale;
        const rZ = 0;

        const driftX = p.startX + Math.sin(elapsed * p.speedX) * p.ampX;
        const driftY = p.startY + Math.sin(elapsed * p.speedY) * p.ampY;
        const driftZ = p.startZ + Math.sin(elapsed * p.speedZ) * p.ampZ;

        const particleDelay = ((p.pIndex * 7 + p.rIndex * 13) % 100) / 100;
        const delayedEase = Math.max(0, Math.min(1, (assembleProgress - particleDelay * 0.3) / 0.7));
        const smoothParticleEase = 1 - Math.pow(1 - delayedEase, 3);

        // Lerp between drift and Ring
        let currentX = driftX + (targetX - driftX) * smoothParticleEase;
        let currentY = driftY + (targetY - driftY) * smoothParticleEase;
        let currentZ = driftZ + (targetZ - driftZ) * smoothParticleEase;

        // Lerp between Ring and Recap Line
        if (easeMorph > 0) {
          currentX = currentX + (rX - currentX) * easeMorph;
          currentY = currentY + (rY - currentY) * easeMorph;
          currentZ = currentZ + (rZ - currentZ) * easeMorph;
        }

        // Project point (flatten the tilt when morphing to line)
        const currentTilt = tiltAngle * (1 - easeMorph);
        const ct = Math.cos(currentTilt);
        const st = Math.sin(currentTilt);
        
        const y1 = currentY * ct - currentZ * st;
        const z1 = currentY * st + currentZ * ct;
        const depth = focalLength + z1 + cameraZ;
        const scale = depth > 0 ? focalLength / depth : 0;
        
        const projX = centerX + currentX * scale;
        const projY = centerY + y1 * scale;
        
        projectedPoints[rIndex][pIndex] = {
          ...p,
          x: projX,
          y: projY,
          z: z1,
          scale
        };
      });

      for (let rIndex = 0; rIndex < numRings; rIndex++) {
        for (let pIndex = 0; pIndex < pointsPerRing; pIndex++) {
          const p = projectedPoints[rIndex][pIndex];
          if (!p || p.scale <= 0) continue;
          
          if (p.isCategory && categoryRefs.current[p.categoryIndex]) {
            const el = categoryRefs.current[p.categoryIndex];
            if (el) {
              // Labels appear in the second half of the scroll
              let opacity = Math.max(0, (smoothScroll - 0.5) * 2);
              if (dimMenu) opacity *= 0.3;
              el.style.opacity = opacity.toString();
              el.style.transform = `translate(${p.x}px, ${p.y + 50 * p.scale}px) translateX(-50%)`;
              el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
            }
          }
          
          // Depth cueing for the ring
          const depthAlpha = Math.max(0.1, 1 - (p.z + outerRadius) / (outerRadius * 2));
          const baseAlpha = 0.5 * (1 - assembleProgress) + depthAlpha * assembleProgress;
          let finalAlpha = p.isHighlight ? 1 : Math.min(1, baseAlpha * 1.5) * 0.5;
          let radius = p.isHighlight ? 2 * p.scale : 1.2 * p.scale;
          
          const isLineFormed = smoothScroll > 0.8 && p.isCategory;
          
          if (easeMorph > 0.5 && !p.isCategory) {
            // Force non-category particles to form a perfectly straight, thin, uniform line
            const morphFactor = (easeMorph - 0.5) * 2;
            radius = radius * (1 - morphFactor) + 0.8 * morphFactor;
            finalAlpha = finalAlpha * (1 - morphFactor) + 0.5 * morphFactor;
          }
          
          if (isLineFormed) {
            finalAlpha = 1;
            radius = 4 * p.scale;
            if (p.categoryIndex === activeCategoryIndex) {
              ctx.shadowColor = 'rgba(255, 255, 255, 1)';
              ctx.shadowBlur = 30;
              radius = 5 * p.scale;
            } else {
              ctx.shadowBlur = 0;
            }
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(255, 255, 255, ${finalAlpha})`;
          }
          
          ctx.beginPath();
          if (isLineFormed) {
            // Draw a beautiful 4-point star for the markers
            ctx.fillStyle = `rgba(255, 255, 255, ${finalAlpha})`;
            const size = radius * 1.5;
            ctx.moveTo(p.x, p.y - size);
            ctx.quadraticCurveTo(p.x, p.y, p.x + size, p.y);
            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + size);
            ctx.quadraticCurveTo(p.x, p.y, p.x - size, p.y);
            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - size);
            ctx.fill();
          } else {
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      let agoraAlpha = 0;
      let agoraScale = 0.8;
      
      // Auto fade-in and luxurious zoom effect
      if (elapsed > 1.5) {
        agoraAlpha = Math.min(1, (elapsed - 1.5) / 1.0); // Full opacity at 2.5s
        agoraScale = 0.8 + 0.2 * Math.min(1, (elapsed - 1.5) / 2.5); // Zooms to 1.0 at 4.0s
      }
      
      // Fade out rapidly when scrolling starts
      if (smoothScroll > 0) {
        agoraAlpha = Math.max(0, agoraAlpha * (1 - (smoothScroll / 0.2)));
      }
      
      // Professional, thin, and luminous GORA title
      if (agoraAlpha > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${agoraAlpha})`;
        // Thin, elegant font, increased size to 75px as requested
        ctx.font = '200 75px "Inter", "Helvetica Neue", "Segoe UI", sans-serif';
        if ('letterSpacing' in ctx) {
          (ctx as any).letterSpacing = '20px';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Clean, precise glow (luminous but not blurry)
        ctx.shadowColor = `rgba(255, 255, 255, ${agoraAlpha})`;
        ctx.shadowBlur = 12;
        
        // Apply zoom and translate
        ctx.translate(centerX, centerY);
        ctx.scale(agoraScale, agoraScale);
        
        ctx.fillText('GORA', 10, 0); // Compensate letterSpacing
        
        ctx.restore();
      }

      ctx.globalAlpha = 1;

      if (indicatorRef.current) {
        indicatorRef.current.style.opacity = (smoothScroll > 0.8) ? '0' : '0.5';
      }

      // Fire ready event when scroll is complete
      if (smoothScroll >= 0.99 && !hasFiredReady.current) {
        hasFiredReady.current = true;
        onMenuReady(true);
      } else if (smoothScroll < 0.99 && hasFiredReady.current) {
        hasFiredReady.current = false;
        onMenuReady(false);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    window.scrollTo({ top: 0 });

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const categories = [
    "1 · Organization",
    "2 · Appoint",
    "3 · My Role",
    "4 · Sign",
    "5 · The Challenge",
    "0 · How to Use"
  ];

  return (
    <div ref={containerRef} className="relative w-full bg-gradient-to-b from-[#0a1128] to-[#1a2b4c] font-sans" style={{ height: '300vh' }}>
      
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0" />

      <div className="fixed inset-0 w-full h-full pointer-events-none z-10 overflow-hidden">
        {categories.map((cat, index) => (
          <div
            key={index}
            ref={el => categoryRefs.current[index] = el}
            onClick={() => {
              onCategorySelect(index);
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}
            className={`absolute top-0 left-0 opacity-0 cursor-pointer transition-colors duration-300 pointer-events-none group ${
              activeCategoryIndex === index ? 'is-active' : ''
            }`}
            style={{ willChange: 'transform, opacity' }}
          >
            <div className={`relative px-4 py-1.5 transition-all duration-500 backdrop-blur-md text-xs md:text-sm tracking-wide whitespace-nowrap shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_40px_rgba(255,245,190,0.7)] group-hover:scale-105 ${
              activeCategoryIndex === index 
                ? 'text-white'
                : 'rounded-full border bg-white/5 border-white/20 text-white/70 group-hover:bg-white/20 group-hover:text-white group-hover:border-white/80'
            }`}>
              {activeCategoryIndex === index && (
                <>
                  <div className="absolute inset-0 border border-white/30 rounded-sm pointer-events-none shadow-[inset_0_0_15px_rgba(255,255,255,0.1)]" />
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rotate-45 shadow-[0_0_10px_rgba(255,255,255,1)]" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rotate-45 shadow-[0_0_10px_rgba(255,255,255,1)]" />
                  <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white rotate-45 shadow-[0_0_10px_rgba(255,255,255,1)]" />
                  <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rotate-45 shadow-[0_0_10px_rgba(255,255,255,1)]" />
                </>
              )}
              {cat}
            </div>
          </div>
        ))}
      </div>
      
      {/* Scroll indicator at the top */}
      <div className="fixed bottom-12 left-0 w-full flex justify-center pointer-events-none z-10">
        <div ref={indicatorRef} className="transition-opacity duration-500 opacity-50">
          <div className="flex flex-col items-center gap-2 text-white/50 text-xs">
            <span className="animate-bounce">↓</span>
            Scroll down
          </div>
        </div>
      </div>

    </div>
  );
}
