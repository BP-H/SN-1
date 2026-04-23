// src/components/World3D.tsx
import React, { useEffect, useRef } from "react";

/**
 * Orb Mesh background (Canvas 2D, zero deps)
 * - “3D-ish” parallax spheres + soft glow
 * - subtle link lines
 * - tint eases toward the dominant color of the visible post image
 * - TS-safe: no "ctx is possibly null" errors
 */

type RGB = { r: number; g: number; b: number };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c: RGB, d: RGB, t: number): RGB => ({ r: lerp(c.r, d.r, t), g: lerp(c.g, d.g, t), b: lerp(c.b, d.b, t) });
const rgba = (c: RGB, a = 1) => `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${a})`;

function avgColor(img: HTMLImageElement): RGB | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const c2 = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!c2) return null;
    c2.drawImage(img, 0, 0, 24, 24);
    const { data } = c2.getImageData(0, 0, 24, 24);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 8) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return null;
    return { r: r / n, g: g / n, b: b / n };
  } catch {
    return null;
  }
}

type Orb = {
  x: number; y: number; z: number;       // position in “scene space”
  rx: number; ry: number;                 // orbit radii
  t: number;                              // phase
  s: number;                              // speed
  r: number;                              // radius
  hue: number;                            // hue flavor
};

export default function World3D() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // ---- ctx (non-null after guard)
    const ctxMaybe = canvas.getContext("2d");
    if (!ctxMaybe) return;
    const ctx = ctxMaybe as CanvasRenderingContext2D;

    // ---- DPR + resize
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * DPR));
      canvas.height = Math.max(1, Math.floor(h * DPR));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- Orbs
    const ORBS = 64;
    const orbs: Orb[] = new Array(ORBS).fill(0).map((_, i) => {
      const rx = 120 + Math.random() * 520;
      const ry = 80 + Math.random() * 360;
      const r = 1.5 + Math.random() * 5.5;
      return {
        x: 0, y: 0, z: Math.random() * 2 - 1,
        rx, ry,
        t: Math.random() * Math.PI * 2,
        s: 0.002 + Math.random() * 0.006,
        r,
        hue: 200 + Math.random() * 90 + (i % 3 === 0 ? 140 : 0)
      } as Orb;
    });

    // ---- Tint that eases toward current post color
    let tint: RGB = { r: 48, g: 64, b: 140 };
    let tintTarget: RGB = { r: 48, g: 64, b: 140 };

    // Watch visible post images
    let io: IntersectionObserver | null = null;
    const scanImages = () => {
      io?.disconnect();
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".pc-media img"));
      if (!imgs.length) return;
      io = new IntersectionObserver(entries => {
        const best = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const c = avgColor(best.target as HTMLImageElement);
        if (c) tintTarget = c;
      }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
      imgs.forEach(img => (img.complete ? io!.observe(img) : img.addEventListener("load", () => io!.observe(img), { once: true })));
    };
    scanImages();

    const feed = document.querySelector(".feed-content");
    let mo: MutationObserver | null = null;
    if (feed) {
      mo = new MutationObserver(() => scanImages());
      mo.observe(feed, { childList: true, subtree: true });
    }

    // ---- Draw helpers (always receive non-null ctx)
    const drawBackground = (c: CanvasRenderingContext2D, w: number, h: number) => {
      const grad = c.createRadialGradient(0.12 * w, 0.18 * h, 60, 0.12 * w, 0.18 * h, Math.max(w, h));
      const g1 = rgba(mix({ r: 10, g: 16, b: 30 }, tint, 0.55), 0.9);
      const g2 = rgba(mix({ r: 7, g: 10, b: 23 }, tint, 0.25), 1);
      grad.addColorStop(0, g1);
      grad.addColorStop(1, g2);
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
    };

    const project = (w: number, h: number, o: Orb) => {
      // simple perspective on z ∈ [-1,1]
      const depth = (o.z + 1) * 0.5;       // 0..1
      const scale = 0.75 + depth * 0.85;   // 0.75..1.6
      const cx = w * 0.5, cy = h * 0.52;
      return {
        px: cx + o.x * scale,
        py: cy + o.y * scale,
        pr: o.r * (0.8 + depth * 1.6),
        scale
      };
    };

    const drawLinks = (c: CanvasRenderingContext2D, pts: { x: number; y: number; depth: number }[]) => {
      // very light connecting lines to closest neighbors
      for (let i = 0; i < pts.length; i++) {
        let nearest = -1, nd = 9e9;
        for (let j = 0; j < pts.length; j++) {
          if (i === j) continue;
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nd) { nd = d2; nearest = j; }
        }
        if (nearest >= 0 && nd < 220 * 220) {
          const a = pts[i], b = pts[nearest];
          const alpha = clamp(0.22 - Math.sqrt(nd) / 1000, 0, 0.22) * (0.5 + 0.5 * (a.depth + b.depth));
          c.strokeStyle = rgba({ r: 160, g: 175, b: 255 }, alpha);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
          c.stroke();
        }
      }
    };

    // ---- Loop
    let raf = 0;
    const tick = () => {
      const w = canvas.width / DPR;
      const h = canvas.height / DPR;

      // ease tint
      tint = mix(tint, tintTarget, 0.06);

      // background
      drawBackground(ctx, w, h);

      // update / draw orbs
      const pts: { x: number; y: number; depth: number }[] = [];
      for (const o of orbs) {
        o.t += o.s;
        o.x = Math.cos(o.t) * o.rx;
        o.y = Math.sin(o.t * 0.9) * o.ry;
        o.z += (Math.sin(o.t * 0.7 + o.rx * 0.001) * 0.006);
        if (o.z > 1) o.z = -1;
        if (o.z < -1) o.z = 1;

        const { px, py, pr } = project(w, h, o);

        // glow
        ctx.beginPath();
        ctx.shadowBlur = 24 + o.r * 6;
        ctx.shadowColor = `hsla(${o.hue}, 80%, 70%, .6)`;
        ctx.fillStyle = `hsla(${o.hue}, 85%, ${55 + (o.z + 1) * 12}%, .9)`;
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        pts.push({ x: px, y: py, depth: (o.z + 1) * 0.5 });
      }

      // links
      drawLinks(ctx, pts);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      io?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="world-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}
