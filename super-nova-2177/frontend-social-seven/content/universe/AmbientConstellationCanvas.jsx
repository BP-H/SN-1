"use client";

import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function AmbientConstellationCanvas({
  className = "",
  density = 40,
  anchors = [],
  frameMs = 42,
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
    const orbs = Array.from({ length: orbCount }, (_, index) => {
      const angle = (index / orbCount) * Math.PI * 2;
      return {
        rx: 48 + Math.random() * 210,
        ry: 34 + Math.random() * 150,
        phase: angle + Math.random() * Math.PI,
        speed: 0.001 + Math.random() * 0.0021,
        radius: 0.7 + Math.random() * 2.3,
        z: Math.random() * 2 - 1,
        hue: 200 + Math.random() * 88 + (index % 4 === 0 ? 126 : 0),
      };
    });

    const drawBackground = () => {
      const gradient = ctx.createRadialGradient(width * 0.38, height * 0.28, 12, width * 0.45, height * 0.44, Math.max(width, height) * 0.88);
      gradient.addColorStop(0, "rgba(255, 79, 143, 0.12)");
      gradient.addColorStop(0.42, "rgba(69, 178, 255, 0.08)");
      gradient.addColorStop(1, "rgba(3, 5, 10, 0.08)");
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    };

    const project = (orb) => {
      const depth = (orb.z + 1) * 0.5;
      const scale = 0.74 + depth * 0.82;
      return {
        x: width * 0.5 + Math.cos(orb.phase) * orb.rx * scale,
        y: height * 0.52 + Math.sin(orb.phase * 0.9) * orb.ry * scale,
        r: orb.radius * (0.7 + depth * 1.45),
        depth,
      };
    };

    let raf = 0;
    let lastPaint = 0;
    const tick = (time = 0) => {
      if (time - lastPaint < frameMs) {
        raf = window.requestAnimationFrame(tick);
        return;
      }
      lastPaint = time;
      drawBackground();
      const points = [];
      orbs.forEach((orb) => {
        if (!reducedMotion) {
          orb.phase += orb.speed;
          orb.z += Math.sin(orb.phase * 0.7 + orb.rx * 0.004) * 0.003;
          if (orb.z > 1) orb.z = -1;
          if (orb.z < -1) orb.z = 1;
        }
        const point = project(orb);
        points.push(point);
        ctx.beginPath();
        ctx.shadowBlur = 14 + orb.radius * 5;
        ctx.shadowColor = `hsla(${orb.hue}, 88%, 72%, 0.45)`;
        ctx.fillStyle = `hsla(${orb.hue}, 88%, ${58 + point.depth * 14}%, ${0.55 + point.depth * 0.24})`;
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      points.forEach((source, index) => {
        let nearest = null;
        let nearestDistance = Infinity;
        points.forEach((target, targetIndex) => {
          if (index === targetIndex) return;
          const distance = Math.hypot(source.x - target.x, source.y - target.y);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = target;
          }
        });
        if (!nearest || nearestDistance > 140) return;
        ctx.strokeStyle = `rgba(154, 196, 255, ${clamp(0.16 - nearestDistance / 820, 0.015, 0.14)})`;
        ctx.lineWidth = 0.42;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(nearest.x, nearest.y);
        ctx.stroke();
      });

      const anchors = anchorsRef.current || [];
      if (anchors.length) {
        const projectedAnchors = anchors.slice(0, 36).map((anchor) => ({
          x: (Number(anchor.x || 0) / 280) * width,
          y: (Number(anchor.y || 0) / 210) * height,
          intensity: clamp(Number(anchor.intensity || 1), 0.45, 1.65),
        }));
        points.forEach((point, index) => {
          if (index % 2 !== 0) return;
          let nearest = null;
          let nearestDistance = Infinity;
          projectedAnchors.forEach((anchor) => {
            const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearest = anchor;
            }
          });
          if (!nearest || nearestDistance > 118) return;
          ctx.strokeStyle = `rgba(255, 99, 181, ${clamp(0.18 - nearestDistance / 780, 0.018, 0.14) * nearest.intensity})`;
          ctx.lineWidth = 0.34 + nearest.intensity * 0.16;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(nearest.x, nearest.y);
          ctx.stroke();
        });
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer?.disconnect();
    };
  }, [density, frameMs, maxDpr]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
