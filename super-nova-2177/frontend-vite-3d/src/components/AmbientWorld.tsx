import React, { useEffect, useRef } from "react";

/**
 * Lightweight ambient orb canvas sized to its parent container.
 * Extracted from the World3D component.
 */

type Orb = {
  x: number; y: number; z: number;
  rx: number; ry: number;
  t: number; s: number;
  r: number; hue: number;
};

export default function AmbientWorld({ className }: { className?: string } = {}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height || w * 0.5625; // fall back to 16:9
      canvas.width = Math.max(1, Math.floor(w * DPR));
      canvas.height = Math.max(1, Math.floor(h * DPR));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (canvas.parentElement) ro?.observe(canvas.parentElement);

    const ORBS = 32;
    const orbs: Orb[] = new Array(ORBS).fill(0).map((_, i) => {
      const rx = 40 + Math.random() * 160;
      const ry = 30 + Math.random() * 120;
      const r = 1 + Math.random() * 4;
      return {
        x: 0, y: 0, z: Math.random() * 2 - 1,
        rx, ry,
        t: Math.random() * Math.PI * 2,
        s: 0.002 + Math.random() * 0.004,
        r,
        hue: 200 + Math.random() * 90 + (i % 3 === 0 ? 140 : 0),
      } as Orb;
    });

    const drawBackground = (c: CanvasRenderingContext2D, w: number, h: number) => {
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(10,16,30,0.9)");
      grad.addColorStop(1, "rgba(7,10,23,1)");
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
    };

    const project = (w: number, h: number, o: Orb) => {
      const depth = (o.z + 1) * 0.5;
      const scale = 0.75 + depth * 0.85;
      const cx = w * 0.5, cy = h * 0.5;
      return {
        px: cx + o.x * scale,
        py: cy + o.y * scale,
        pr: o.r * (0.8 + depth * 1.6),
      };
    };

    let raf = 0;
    const tick = () => {
      const w = canvas.width / DPR;
      const h = canvas.height / DPR;
      drawBackground(ctx, w, h);
      for (const o of orbs) {
        o.t += o.s;
        o.x = Math.cos(o.t) * o.rx;
        o.y = Math.sin(o.t * 0.9) * o.ry;
        o.z += Math.sin(o.t * 0.7 + o.rx * 0.001) * 0.006;
        if (o.z > 1) o.z = -1;
        if (o.z < -1) o.z = 1;
        const { px, py, pr } = project(w, h, o);
        ctx.beginPath();
        ctx.shadowBlur = 14 + o.r * 4;
        ctx.shadowColor = `hsla(${o.hue}, 80%, 70%, .6)`;
        ctx.fillStyle = `hsla(${o.hue}, 85%, ${55 + (o.z + 1) * 12}%, .9)`;
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(() => {
      canvas.style.opacity = "1";
      tick();
    });

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} />;
}

