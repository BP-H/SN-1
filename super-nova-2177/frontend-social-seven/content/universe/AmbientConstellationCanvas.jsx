"use client";

import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/* Pre-rendered glow sprites: drawing a blurred orb with ctx.shadowBlur costs a
   full gaussian pass per fill, which made this canvas the most expensive thing
   on the page. A tinted radial-gradient sprite drawn with drawImage is visually
   identical at these sizes and an order of magnitude cheaper. */
const SPRITE_SIZE = 64;
const SPRITE_HALF = SPRITE_SIZE / 2;

function createGlowSprite(hue) {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;
  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;
  const gradient = ctx.createRadialGradient(SPRITE_HALF, SPRITE_HALF, 0, SPRITE_HALF, SPRITE_HALF, SPRITE_HALF);
  gradient.addColorStop(0, `hsla(${hue}, 92%, 86%, 0.95)`);
  gradient.addColorStop(0.22, `hsla(${hue}, 88%, 68%, 0.7)`);
  gradient.addColorStop(0.55, `hsla(${hue}, 88%, 62%, 0.22)`);
  gradient.addColorStop(1, `hsla(${hue}, 88%, 60%, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return sprite;
}

export default function AmbientConstellationCanvas({
  className = "",
  density = 40,
  anchors = [],
  frameMs = 30,
  maxDpr = 1.5,
}) {
  const canvasRef = useRef(null);
  const anchorsRef = useRef([]);

  useEffect(() => {
    anchorsRef.current = anchors;
  }, [anchors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const parent = canvas.parentElement;
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = parent?.getBoundingClientRect?.() || { width: window.innerWidth, height: window.innerHeight };
      width = Math.max(1, rect.width || window.innerWidth);
      height = Math.max(1, rect.height || window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (parent) observer?.observe(parent);
    window.addEventListener("resize", resize);

    const orbCount = clamp(Number(density) || 40, 16, 64);
    const spriteCache = new Map();
    const spriteFor = (hue) => {
      const bucket = Math.round(hue / 12) * 12;
      let sprite = spriteCache.get(bucket);
      if (!sprite) {
        sprite = createGlowSprite(bucket);
        spriteCache.set(bucket, sprite);
      }
      return sprite;
    };
    const orbs = Array.from({ length: orbCount }, (_, index) => {
      const angle = (index / orbCount) * Math.PI * 2;
      const hue = 200 + Math.random() * 88 + (index % 4 === 0 ? 126 : 0);
      return {
        rx: 48 + Math.random() * 210,
        ry: 34 + Math.random() * 150,
        phase: angle + Math.random() * Math.PI,
        speed: 0.001 + Math.random() * 0.0021,
        radius: 0.7 + Math.random() * 2.3,
        z: Math.random() * 2 - 1,
        hue,
        sprite: spriteFor(hue),
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0006 + Math.random() * 0.0014,
      };
    });

    /* Reused per-frame point store: no allocation inside the loop. */
    const pointX = new Float32Array(orbCount);
    const pointY = new Float32Array(orbCount);
    const pointR = new Float32Array(orbCount);
    const pointDepth = new Float32Array(orbCount);

    const drawBackground = (time) => {
      /* The nebula centers drift very slowly so the field never reads as a
         static wallpaper. */
      const driftX = Math.sin(time * 0.00005) * 0.07;
      const driftY = Math.cos(time * 0.000037) * 0.05;
      const span = Math.max(width, height);
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(
        width * (0.38 + driftX),
        height * (0.28 + driftY),
        12,
        width * 0.45,
        height * 0.44,
        span * 0.88
      );
      gradient.addColorStop(0, "rgba(255, 79, 143, 0.12)");
      gradient.addColorStop(0.42, "rgba(69, 178, 255, 0.08)");
      gradient.addColorStop(1, "rgba(3, 5, 10, 0.08)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      const counterGlow = ctx.createRadialGradient(
        width * (0.72 - driftX),
        height * (0.78 - driftY),
        8,
        width * (0.72 - driftX),
        height * (0.78 - driftY),
        span * 0.5
      );
      counterGlow.addColorStop(0, "rgba(94, 141, 250, 0.07)");
      counterGlow.addColorStop(1, "rgba(94, 141, 250, 0)");
      ctx.fillStyle = counterGlow;
      ctx.fillRect(0, 0, width, height);
    };

    let raf = 0;
    let lastPaint = 0;
    let visible = true;

    const tick = (time = 0) => {
      raf = window.requestAnimationFrame(tick);
      if (!visible) return;
      if (time - lastPaint < frameMs) return;
      lastPaint = time;
      drawBackground(time);

      for (let index = 0; index < orbCount; index += 1) {
        const orb = orbs[index];
        if (!reducedMotion) {
          orb.phase += orb.speed;
          orb.z += Math.sin(orb.phase * 0.7 + orb.rx * 0.004) * 0.003;
          if (orb.z > 1) orb.z = -1;
          if (orb.z < -1) orb.z = 1;
        }
        const depth = (orb.z + 1) * 0.5;
        const scale = 0.74 + depth * 0.82;
        const x = width * 0.5 + Math.cos(orb.phase) * orb.rx * scale;
        const y = height * 0.52 + Math.sin(orb.phase * 0.9) * orb.ry * scale;
        const r = orb.radius * (0.7 + depth * 1.45);
        pointX[index] = x;
        pointY[index] = y;
        pointR[index] = r;
        pointDepth[index] = depth;
        /* Sprite spans ~3.4x the orb radius so the soft halo matches the old
           shadowBlur look. Slow per-orb twinkle keeps the field alive. */
        const drawSize = r * 6.8;
        const twinkle = reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(time * orb.twinkleSpeed + orb.twinklePhase);
        ctx.globalAlpha = (0.55 + depth * 0.24) * twinkle;
        ctx.drawImage(orb.sprite, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      }
      ctx.globalAlpha = 1;

      for (let index = 0; index < orbCount; index += 1) {
        let nearestIndex = -1;
        let nearestSquared = Infinity;
        for (let target = 0; target < orbCount; target += 1) {
          if (target === index) continue;
          const dx = pointX[index] - pointX[target];
          const dy = pointY[index] - pointY[target];
          const squared = dx * dx + dy * dy;
          if (squared < nearestSquared) {
            nearestSquared = squared;
            nearestIndex = target;
          }
        }
        if (nearestIndex < 0 || nearestSquared > 140 * 140) continue;
        const nearestDistance = Math.sqrt(nearestSquared);
        ctx.strokeStyle = `rgba(154, 196, 255, ${clamp(0.16 - nearestDistance / 820, 0.015, 0.14)})`;
        ctx.lineWidth = 0.42;
        ctx.beginPath();
        ctx.moveTo(pointX[index], pointY[index]);
        ctx.lineTo(pointX[nearestIndex], pointY[nearestIndex]);
        ctx.stroke();
      }

      const anchorList = anchorsRef.current || [];
      if (anchorList.length) {
        const anchorCount = Math.min(anchorList.length, 36);
        for (let index = 0; index < orbCount; index += 2) {
          let nearestX = 0;
          let nearestY = 0;
          let nearestIntensity = 1;
          let nearestSquared = Infinity;
          for (let a = 0; a < anchorCount; a += 1) {
            const anchor = anchorList[a];
            const anchorX = (Number(anchor.x || 0) / 280) * width;
            const anchorY = (Number(anchor.y || 0) / 210) * height;
            const dx = pointX[index] - anchorX;
            const dy = pointY[index] - anchorY;
            const squared = dx * dx + dy * dy;
            if (squared < nearestSquared) {
              nearestSquared = squared;
              nearestX = anchorX;
              nearestY = anchorY;
              nearestIntensity = clamp(Number(anchor.intensity || 1), 0.45, 1.65);
            }
          }
          if (nearestSquared > 118 * 118) continue;
          const nearestDistance = Math.sqrt(nearestSquared);
          ctx.strokeStyle = `rgba(255, 99, 181, ${clamp(0.18 - nearestDistance / 780, 0.018, 0.14) * nearestIntensity})`;
          ctx.lineWidth = 0.34 + nearestIntensity * 0.16;
          ctx.beginPath();
          ctx.moveTo(pointX[index], pointY[index]);
          ctx.lineTo(nearestX, nearestY);
          ctx.stroke();
        }
      }
    };

    /* Stop painting entirely while scrolled out of view. */
    const intersection = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting !== false;
        })
      : null;
    intersection?.observe(canvas);

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer?.disconnect();
      intersection?.disconnect();
    };
  }, [density, frameMs, maxDpr]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
