"use client";

import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 280;
const VIEWBOX_HEIGHT = 210;

const SPECIES_COLORS = {
  human: {
    core: "rgba(255, 79, 143, 0.95)",
    glow: "rgba(255, 79, 143, 0.36)",
    line: "rgba(255, 92, 160, 0.74)",
  },
  ai: {
    core: "rgba(94, 141, 250, 0.96)",
    glow: "rgba(94, 141, 250, 0.34)",
    line: "rgba(115, 182, 255, 0.72)",
  },
  company: {
    core: "rgba(158, 168, 184, 0.94)",
    glow: "rgba(158, 168, 184, 0.24)",
    line: "rgba(180, 190, 204, 0.52)",
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initials(username = "") {
  return username.trim().slice(0, 2).toUpperCase() || "SN";
}

function speciesColors(species = "human") {
  return SPECIES_COLORS[species] || SPECIES_COLORS.human;
}

function edgeCurve(edge, index = 0, isImmersive = false) {
  const source = edge.sourceNode || {};
  const target = edge.targetNode || {};
  const startX = Number(source.visualX || 0);
  const startY = Number(source.visualY || 0);
  const endX = Number(target.visualX || 0);
  const endY = Number(target.visualY || 0);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const side = index % 2 === 0 ? 1 : -1;
  const sweep = clamp(distance * (isImmersive ? 0.2 : 0.16), isImmersive ? 10 : 6, isImmersive ? 34 : 22);
  const midpointX = (startX + endX) / 2;
  const midpointY = (startY + endY) / 2;
  return {
    startX,
    startY,
    controlX: midpointX - (deltaY / distance) * sweep * side,
    controlY: midpointY + (deltaX / distance) * sweep * side * 0.76,
    endX,
    endY,
  };
}

function drawCurve(ctx, curve) {
  ctx.beginPath();
  ctx.moveTo(curve.startX, curve.startY);
  ctx.quadraticCurveTo(curve.controlX, curve.controlY, curve.endX, curve.endY);
}

function distanceToQuadratic(point, curve) {
  let nearest = Infinity;
  let previous = { x: curve.startX, y: curve.startY };
  for (let step = 1; step <= 18; step += 1) {
    const t = step / 18;
    const oneMinus = 1 - t;
    const next = {
      x: oneMinus * oneMinus * curve.startX + 2 * oneMinus * t * curve.controlX + t * t * curve.endX,
      y: oneMinus * oneMinus * curve.startY + 2 * oneMinus * t * curve.controlY + t * t * curve.endY,
    };
    const segmentX = next.x - previous.x;
    const segmentY = next.y - previous.y;
    const segmentLength = Math.max(1, segmentX * segmentX + segmentY * segmentY);
    const projection = clamp(((point.x - previous.x) * segmentX + (point.y - previous.y) * segmentY) / segmentLength, 0, 1);
    const hitX = previous.x + segmentX * projection;
    const hitY = previous.y + segmentY * projection;
    nearest = Math.min(nearest, Math.hypot(point.x - hitX, point.y - hitY));
    previous = next;
  }
  return nearest;
}

function drawOrbitalField(ctx, isLightTheme) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const coreGradient = ctx.createRadialGradient(140, 104, 4, 140, 104, 82);
  coreGradient.addColorStop(0, isLightTheme ? "rgba(255, 79, 143, 0.34)" : "rgba(255, 79, 143, 0.42)");
  coreGradient.addColorStop(0.38, isLightTheme ? "rgba(94, 141, 250, 0.14)" : "rgba(94, 141, 250, 0.18)");
  coreGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = coreGradient;
  ctx.beginPath();
  ctx.ellipse(140, 104, 92, 74, -0.16, 0, Math.PI * 2);
  ctx.fill();

  const orbitColor = isLightTheme ? "rgba(48, 64, 95, 0.15)" : "rgba(255, 255, 255, 0.16)";
  const accentColor = isLightTheme ? "rgba(255, 79, 143, 0.19)" : "rgba(255, 116, 181, 0.24)";
  [
    { rx: 96, ry: 38, rotate: -0.2, color: orbitColor, dash: [2, 8] },
    { rx: 118, ry: 52, rotate: 0.25, color: "rgba(94, 141, 250, 0.18)", dash: [1.5, 8] },
    { rx: 68, ry: 92, rotate: 0.82, color: accentColor, dash: [1, 9] },
    { rx: 42, ry: 24, rotate: 0.32, color: accentColor, dash: [2, 7] },
  ].forEach((orbit) => {
    ctx.beginPath();
    ctx.setLineDash(orbit.dash);
    ctx.lineWidth = 0.65;
    ctx.strokeStyle = orbit.color;
    ctx.ellipse(140, 104, orbit.rx, orbit.ry, orbit.rotate, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  ctx.fillStyle = isLightTheme ? "rgba(255, 79, 143, 0.84)" : "rgba(255, 79, 143, 0.9)";
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(255, 79, 143, 0.54)";
  ctx.beginPath();
  ctx.arc(140, 104, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGraph(ctx, nodes, edges, selectedNodeId, selectedEdgeId, currentUser, isImmersive, isLightTheme) {
  drawOrbitalField(ctx, isLightTheme);

  edges.forEach((edge, index) => {
    const curve = edgeCurve(edge, index, isImmersive);
    const active = selectedEdgeId === edge.id;
    const sourceColors = speciesColors(edge.sourceNode?.species);
    const targetColors = speciesColors(edge.targetNode?.species);
    const strength = Number(edge.strength || 0);
    const width = isImmersive
      ? Math.max(0.22, Math.min(1.1, 0.24 + strength / 68))
      : Math.max(0.42, Math.min(1.72, 0.42 + strength / 34));

    drawCurve(ctx, curve);
    ctx.lineWidth = width + (active ? 3.4 : 2.1);
    ctx.lineCap = "round";
    ctx.strokeStyle = active
      ? "rgba(255, 79, 143, 0.26)"
      : isLightTheme ? "rgba(255, 255, 255, 0.66)" : "rgba(255, 255, 255, 0.1)";
    ctx.shadowBlur = active ? 12 : 4;
    ctx.shadowColor = active ? "rgba(255, 79, 143, 0.34)" : sourceColors.glow;
    ctx.stroke();

    const gradient = ctx.createLinearGradient(curve.startX, curve.startY, curve.endX, curve.endY);
    gradient.addColorStop(0, sourceColors.line);
    gradient.addColorStop(1, targetColors.line);
    drawCurve(ctx, curve);
    ctx.lineWidth = width;
    ctx.strokeStyle = active ? "rgba(255, 79, 143, 0.9)" : gradient;
    ctx.shadowBlur = active ? 10 : 5;
    ctx.shadowColor = active ? "rgba(255, 79, 143, 0.42)" : "rgba(94, 141, 250, 0.24)";
    ctx.stroke();
  });

  nodes.forEach((node) => {
    const selected = selectedNodeId === node.id;
    const current = node.is_current || (currentUser && node.id === currentUser.toLowerCase());
    const colors = speciesColors(node.species);
    const radius = Number(node.radius || 4);
    const x = Number(node.visualX || 0);
    const y = Number(node.visualY || 0);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const aura = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius + (selected || current ? 18 : 10));
    aura.addColorStop(0, selected || current ? colors.glow : colors.glow.replace("0.36", "0.22"));
    aura.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, radius + (selected || current ? 17 : 10), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = selected || current ? 18 : 10;
    ctx.shadowColor = selected || current ? colors.glow : "rgba(94, 141, 250, 0.22)";
    ctx.fillStyle = colors.core;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = selected || current ? 2.25 : 0.9;
    ctx.strokeStyle = selected || current
      ? "rgba(255, 255, 255, 0.88)"
      : isLightTheme ? "rgba(28, 38, 62, 0.22)" : "rgba(255, 255, 255, 0.42)";
    ctx.beginPath();
    ctx.arc(x, y, radius + (selected || current ? 3.2 : 2.2), 0, Math.PI * 2);
    ctx.stroke();

    const showLabel = !isImmersive || selected || current || radius >= 5.4;
    if (showLabel) {
      ctx.font = "800 5.8px SF Pro Display, Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isLightTheme ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.94)";
      ctx.fillText(initials(node.username), x, y + 0.2);
    }
  });
}

export default function SocialConstellationCanvas({
  className = "",
  nodes = [],
  edges = [],
  selectedNodeId = "",
  selectedEdgeId = "",
  currentUser = "",
  view = { x: 0, y: 0, scale: 1 },
  isImmersive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onDoubleClick,
  onNodeSelect,
  onEdgeSelect,
  onNodeOpen,
}) {
  const canvasRef = useRef(null);
  const pointerStartRef = useRef(null);
  const latestRef = useRef({ nodes, edges, view, isImmersive });

  useEffect(() => {
    latestRef.current = { nodes, edges, view, isImmersive };
  }, [edges, isImmersive, nodes, view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const draw = () => {
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect?.() || { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
      const width = Math.max(1, rect.width || 1);
      const height = Math.max(1, rect.height || 1);
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      const targetWidth = Math.floor(width * dpr);
      const targetHeight = Math.floor(height * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const isLightTheme = document.documentElement?.dataset?.theme === "light";
      const scaleX = width / VIEWBOX_WIDTH;
      const scaleY = height / VIEWBOX_HEIGHT;
      ctx.save();
      ctx.scale(scaleX, scaleY);
      ctx.translate(Number(view.x || 0), Number(view.y || 0));
      ctx.scale(Number(view.scale || 1), Number(view.scale || 1));
      drawGraph(ctx, nodes, edges, selectedNodeId, selectedEdgeId, currentUser, isImmersive, isLightTheme);
      ctx.restore();
    };

    draw();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(draw) : null;
    if (canvas.parentElement) observer?.observe(canvas.parentElement);
    return () => observer?.disconnect();
  }, [currentUser, edges, isImmersive, nodes, selectedEdgeId, selectedNodeId, view]);

  const graphPointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect) return null;
    const viewX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * VIEWBOX_WIDTH;
    const viewY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * VIEWBOX_HEIGHT;
    const latest = latestRef.current;
    const scale = Number(latest.view?.scale || 1);
    return {
      x: (viewX - Number(latest.view?.x || 0)) / scale,
      y: (viewY - Number(latest.view?.y || 0)) / scale,
    };
  };

  const hitTest = (event) => {
    const point = graphPointFromEvent(event);
    if (!point) return {};
    const latest = latestRef.current;
    const node = [...latest.nodes].reverse().find((candidate) => {
      const radius = Number(candidate.radius || 4) + (latest.isImmersive ? 6 : 8);
      return Math.hypot(point.x - Number(candidate.visualX || 0), point.y - Number(candidate.visualY || 0)) <= radius;
    });
    if (node) return { node };
    const edge = latest.edges.find((candidate, index) => {
      const curve = edgeCurve(candidate, index, latest.isImmersive);
      return distanceToQuadratic(point, curve) <= (latest.isImmersive ? 4.8 : 6.5);
    });
    return { edge };
  };

  const handlePointerDown = (event) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    onPointerDown?.(event);
  };

  const handlePointerMove = (event) => {
    onPointerMove?.(event);
    if (event.buttons) return;
    const { node, edge } = hitTest(event);
    if (node) {
      onNodeSelect?.(node);
    } else if (edge) {
      onEdgeSelect?.(edge);
    }
  };

  const handlePointerUp = (event) => {
    onPointerUp?.(event);
  };

  const handleClick = (event) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
    const { node, edge } = hitTest(event);
    if (node) {
      onNodeSelect?.(node);
      onNodeOpen?.(node);
    } else if (edge) {
      onEdgeSelect?.(edge);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Live social constellation"
      role="img"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={onWheel}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    />
  );
}
