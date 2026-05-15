"use client";

import { useEffect, useRef } from "react";

const VIEWBOX_WIDTH = 280;
const VIEWBOX_HEIGHT = 210;

const SPECIES_PALETTE = {
  human: {
    core: [1, 0.31, 0.56],
    glow: [1, 0.22, 0.52],
    line: [1, 0.36, 0.64],
  },
  ai: {
    core: [0.36, 0.55, 1],
    glow: [0.31, 0.62, 1],
    line: [0.48, 0.72, 1],
  },
  company: {
    core: [0.62, 0.67, 0.75],
    glow: [0.58, 0.64, 0.74],
    line: [0.72, 0.76, 0.84],
  },
};

const LINE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_color = a_color;
}
`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 v_color;
void main() {
  gl_FragColor = v_color;
}
`;

const NODE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_color;
attribute float a_size;
attribute float a_depth;
varying vec4 v_color;
varying float v_depth;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
  v_depth = a_depth;
}
`;

const NODE_FRAGMENT_SHADER = `
precision mediump float;
varying vec4 v_color;
varying float v_depth;
void main() {
  vec2 point = gl_PointCoord - vec2(0.5);
  float dist = length(point);
  if (dist > 0.5) discard;
  float core = smoothstep(0.5, 0.05, dist);
  float rim = smoothstep(0.5, 0.32, dist);
  float shell = smoothstep(0.46, 0.34, dist) - smoothstep(0.34, 0.23, dist);
  float highlight = smoothstep(0.26, 0.0, length(point + vec2(0.16, 0.19)));
  vec3 shaded = mix(v_color.rgb * (0.46 + v_depth * 0.2), v_color.rgb * 1.12, core);
  shaded += vec3(0.9, 0.97, 1.0) * highlight * 0.5;
  shaded += vec3(0.72, 0.86, 1.0) * shell * 0.22;
  float alpha = v_color.a * rim;
  gl_FragColor = vec4(shaded, alpha);
}
`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initials(username = "") {
  return username.trim().slice(0, 2).toUpperCase() || "SN";
}

function paletteFor(species = "human") {
  return SPECIES_PALETTE[species] || SPECIES_PALETTE.human;
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

function pointOnCurve(curve, t) {
  const oneMinus = 1 - t;
  return {
    x: oneMinus * oneMinus * curve.startX + 2 * oneMinus * t * curve.controlX + t * t * curve.endX,
    y: oneMinus * oneMinus * curve.startY + 2 * oneMinus * t * curve.controlY + t * t * curve.endY,
  };
}

function distanceToQuadratic(point, curve) {
  let nearest = Infinity;
  let previous = { x: curve.startX, y: curve.startY };
  const samples = 12;
  for (let step = 1; step <= samples; step += 1) {
    const next = pointOnCurve(curve, step / samples);
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

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Unable to compile constellation shader");
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "Unable to link constellation shader");
  }
  return program;
}

function createWebglResources(gl) {
  const lineProgram = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
  const nodeProgram = createProgram(gl, NODE_VERTEX_SHADER, NODE_FRAGMENT_SHADER);
  return {
    lineProgram,
    nodeProgram,
    linePositionBuffer: gl.createBuffer(),
    lineColorBuffer: gl.createBuffer(),
    nodePositionBuffer: gl.createBuffer(),
    nodeColorBuffer: gl.createBuffer(),
    nodeSizeBuffer: gl.createBuffer(),
    nodeDepthBuffer: gl.createBuffer(),
    lineLocations: {
      position: gl.getAttribLocation(lineProgram, "a_position"),
      color: gl.getAttribLocation(lineProgram, "a_color"),
    },
    nodeLocations: {
      position: gl.getAttribLocation(nodeProgram, "a_position"),
      color: gl.getAttribLocation(nodeProgram, "a_color"),
      size: gl.getAttribLocation(nodeProgram, "a_size"),
      depth: gl.getAttribLocation(nodeProgram, "a_depth"),
    },
  };
}

function viewboxMetrics(canvasWidth = VIEWBOX_WIDTH, canvasHeight = VIEWBOX_HEIGHT) {
  const fitScale = Math.max(
    0.0001,
    Math.min(canvasWidth / VIEWBOX_WIDTH, canvasHeight / VIEWBOX_HEIGHT)
  );
  return {
    fitScale,
    offsetX: (canvasWidth - VIEWBOX_WIDTH * fitScale) / 2,
    offsetY: (canvasHeight - VIEWBOX_HEIGHT * fitScale) / 2,
  };
}

function worldToClip(x, y, view = { x: 0, y: 0, scale: 1 }, canvasWidth = VIEWBOX_WIDTH, canvasHeight = VIEWBOX_HEIGHT) {
  const scale = Number(view.scale || 1);
  const metrics = viewboxMetrics(canvasWidth, canvasHeight);
  const screenX = metrics.offsetX + (Number(view.x || 0) + x * scale) * metrics.fitScale;
  const screenY = metrics.offsetY + (Number(view.y || 0) + y * scale) * metrics.fitScale;
  return [(screenX / canvasWidth) * 2 - 1, 1 - (screenY / canvasHeight) * 2];
}

function animatedNode(node, time, isImmersive) {
  const depth = Number(node.depth || 0.74);
  const baseX = Number(node.visualX || 0);
  const baseY = Number(node.visualY || 0);
  const floatX = Math.sin(time * 0.42 + baseX * 0.012 + depth) * (isImmersive ? 1.45 : 0.55) * depth;
  const floatY = Math.cos(time * 0.36 + baseY * 0.011 + depth) * (isImmersive ? 1.05 : 0.42) * depth;
  return {
    ...node,
    visualX: baseX + floatX,
    visualY: baseY + floatY,
    visualDepth: clamp(0.46 + depth * 0.28 + Math.sin(time * 0.24 + baseX * 0.018) * 0.08, 0.36, 1),
  };
}

function graphFrame(nodes, edges, isImmersive, time) {
  const animatedNodes = nodes.map((node) => animatedNode(node, time, isImmersive));
  const byId = new Map(animatedNodes.map((node) => [node.id, node]));
  const animatedEdges = edges
    .map((edge) => ({
      ...edge,
      sourceNode: byId.get(edge.source) || edge.sourceNode,
      targetNode: byId.get(edge.target) || edge.targetNode,
    }))
    .filter((edge) => edge.sourceNode && edge.targetNode);
  return { nodes: animatedNodes, edges: animatedEdges };
}

function pushLineSegment(positions, colors, start, end, color, alpha, view, canvasWidth, canvasHeight) {
  const startClip = worldToClip(start.x, start.y, view, canvasWidth, canvasHeight);
  const endClip = worldToClip(end.x, end.y, view, canvasWidth, canvasHeight);
  positions.push(startClip[0], startClip[1], endClip[0], endClip[1]);
  colors.push(color[0], color[1], color[2], alpha, color[0], color[1], color[2], alpha);
}

function pushOrbitalField(positions, colors, time, isImmersive, view, canvasWidth, canvasHeight) {
  const orbitScale = isImmersive ? 1.18 : 1;
  const orbitColor = [0.66, 0.78, 1];
  const pinkColor = [1, 0.34, 0.64];
  const orbits = [
    { rx: 104, ry: 38, rotate: -0.18, color: orbitColor, alpha: 0.1 },
    { rx: 124, ry: 54, rotate: 0.25, color: orbitColor, alpha: 0.08 },
    { rx: 68, ry: 88, rotate: 0.82, color: pinkColor, alpha: 0.08 },
  ];
  orbits.forEach((orbit, orbitIndex) => {
    const steps = isImmersive ? 56 : 36;
    let previous = null;
    for (let step = 0; step <= steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2 + time * 0.035 * (orbitIndex % 2 ? -1 : 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotatedX = cos * orbit.rx * orbitScale;
      const rotatedY = sin * orbit.ry * orbitScale;
      const x = 140 + rotatedX * Math.cos(orbit.rotate) - rotatedY * Math.sin(orbit.rotate);
      const y = 104 + rotatedX * Math.sin(orbit.rotate) + rotatedY * Math.cos(orbit.rotate);
      const point = { x, y };
      if (previous && step % 3 !== 0) {
        pushLineSegment(positions, colors, previous, point, orbit.color, orbit.alpha, view, canvasWidth, canvasHeight);
      }
      previous = point;
    }
  });
}

function buildLineArrays(edges, selectedEdgeId, isImmersive, time, view, canvasWidth, canvasHeight) {
  const positions = [];
  const colors = [];
  pushOrbitalField(positions, colors, time, isImmersive, view, canvasWidth, canvasHeight);

  edges.forEach((edge, index) => {
    const curve = edgeCurve(edge, index, isImmersive);
    const active = selectedEdgeId === edge.id;
    const sourcePalette = paletteFor(edge.sourceNode?.species);
    const targetPalette = paletteFor(edge.targetNode?.species);
    const sourceColor = active ? [1, 0.36, 0.64] : sourcePalette.line;
    const targetColor = active ? [1, 0.56, 0.75] : targetPalette.line;
    const strength = clamp(Number(edge.strength || 0), 1, 90);
    const alpha = active ? 0.74 : clamp(0.16 + strength / 240, isImmersive ? 0.12 : 0.16, isImmersive ? 0.42 : 0.34);
    const steps = active ? 10 : 6;
    let previous = pointOnCurve(curve, 0);
    for (let step = 1; step <= steps; step += 1) {
      const current = pointOnCurve(curve, step / steps);
      const mix = step / steps;
      const color = [
        sourceColor[0] * (1 - mix) + targetColor[0] * mix,
        sourceColor[1] * (1 - mix) + targetColor[1] * mix,
        sourceColor[2] * (1 - mix) + targetColor[2] * mix,
      ];
      pushLineSegment(positions, colors, previous, current, color, alpha, view, canvasWidth, canvasHeight);
      previous = current;
    }
  });

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  };
}

function buildNodeArrays(nodes, selectedNodeId, currentUser, view, dpr, isImmersive, canvasWidth, canvasHeight) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const depths = [];
  const screenScale = viewboxMetrics(canvasWidth, canvasHeight).fitScale;

  const pushNode = (node, sizeMultiplier, alphaMultiplier) => {
    const selected = selectedNodeId === node.id;
    const current = node.is_current || (currentUser && node.id === currentUser.toLowerCase());
    const palette = paletteFor(node.species);
    const radius = Number(node.radius || 4);
    const depth = Number(node.visualDepth || node.depth || 0.72);
    const clip = worldToClip(Number(node.visualX || 0), Number(node.visualY || 0), view, canvasWidth, canvasHeight);
    const boost = selected || current ? 1.35 : 1;
    positions.push(clip[0], clip[1]);
    colors.push(palette.core[0], palette.core[1], palette.core[2], alphaMultiplier * boost);
    sizes.push(Math.max(7, radius * 2 * Number(view.scale || 1) * screenScale * dpr * sizeMultiplier * (0.82 + depth * 0.32)));
    depths.push(depth);
  };

  nodes.forEach((node) => pushNode(node, isImmersive ? 5.8 : 5.1, 0.18));
  nodes.forEach((node) => pushNode(node, isImmersive ? 2.55 : 2.25, 0.48));
  nodes.forEach((node) => pushNode(node, isImmersive ? 1.35 : 1.22, 0.92));

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    sizes: new Float32Array(sizes),
    depths: new Float32Array(depths),
  };
}

function bindArray(gl, buffer, location, data, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function drawWebglScene(gl, resources, latest, canvasWidth, canvasHeight, dpr, time) {
  const { nodes, edges } = graphFrame(latest.nodes, latest.edges, latest.isImmersive, time);
  gl.viewport(0, 0, Math.floor(canvasWidth * dpr), Math.floor(canvasHeight * dpr));
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  const lineArrays = buildLineArrays(edges, latest.selectedEdgeId, latest.isImmersive, time, latest.view, canvasWidth, canvasHeight);
  gl.useProgram(resources.lineProgram);
  bindArray(gl, resources.linePositionBuffer, resources.lineLocations.position, lineArrays.positions, 2);
  bindArray(gl, resources.lineColorBuffer, resources.lineLocations.color, lineArrays.colors, 4);
  gl.drawArrays(gl.LINES, 0, lineArrays.positions.length / 2);

  const nodeArrays = buildNodeArrays(
    nodes,
    latest.selectedNodeId,
    latest.currentUser,
    latest.view,
    dpr,
    latest.isImmersive,
    canvasWidth,
    canvasHeight,
  );
  gl.useProgram(resources.nodeProgram);
  bindArray(gl, resources.nodePositionBuffer, resources.nodeLocations.position, nodeArrays.positions, 2);
  bindArray(gl, resources.nodeColorBuffer, resources.nodeLocations.color, nodeArrays.colors, 4);
  bindArray(gl, resources.nodeSizeBuffer, resources.nodeLocations.size, nodeArrays.sizes, 1);
  bindArray(gl, resources.nodeDepthBuffer, resources.nodeLocations.depth, nodeArrays.depths, 1);
  gl.drawArrays(gl.POINTS, 0, nodeArrays.positions.length / 2);
}

function drawFallback2d(ctx, latest, width, height, dpr, time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { nodes, edges } = graphFrame(latest.nodes, latest.edges, latest.isImmersive, time);
  const scaleX = width / VIEWBOX_WIDTH;
  const scaleY = height / VIEWBOX_HEIGHT;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.translate(Number(latest.view?.x || 0), Number(latest.view?.y || 0));
  ctx.scale(Number(latest.view?.scale || 1), Number(latest.view?.scale || 1));

  edges.forEach((edge, index) => {
    const curve = edgeCurve(edge, index, latest.isImmersive);
    const palette = paletteFor(edge.sourceNode?.species);
    ctx.strokeStyle = `rgba(${Math.round(palette.line[0] * 255)}, ${Math.round(palette.line[1] * 255)}, ${Math.round(palette.line[2] * 255)}, 0.28)`;
    ctx.lineWidth = latest.selectedEdgeId === edge.id ? 1.2 : 0.55;
    ctx.beginPath();
    ctx.moveTo(curve.startX, curve.startY);
    ctx.quadraticCurveTo(curve.controlX, curve.controlY, curve.endX, curve.endY);
    ctx.stroke();
  });

  nodes.forEach((node) => {
    const palette = paletteFor(node.species);
    const x = Number(node.visualX || 0);
    const y = Number(node.visualY || 0);
    const radius = Number(node.radius || 4);
    const gradient = ctx.createRadialGradient(x - radius * 0.4, y - radius * 0.45, 1, x, y, radius * 3.3);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.2, `rgba(${palette.core.map((value) => Math.round(value * 255)).join(",")}, 0.92)`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (latest.selectedNodeId === node.id || node.is_current) {
      ctx.font = "800 6px SF Pro Display, Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#101827";
      ctx.fillText(node.is_current ? "YOU" : initials(node.username), x, y + radius + 12);
    }
  });
  ctx.restore();
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
  const latestRef = useRef({
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    currentUser,
    view,
    isImmersive,
  });

  useEffect(() => {
    latestRef.current = {
      nodes,
      edges,
      selectedNodeId,
      selectedEdgeId,
      currentUser,
      view,
      isImmersive,
    };
  }, [currentUser, edges, isImmersive, nodes, selectedEdgeId, selectedNodeId, view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let gl = null;
    let resources = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        depth: false,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
      });
      if (gl) resources = createWebglResources(gl);
    } catch {
      gl = null;
      resources = null;
    }
    const fallbackContext = gl ? null : canvas.getContext("2d");
    if (!gl && !fallbackContext) return undefined;

    let raf = 0;
    let lastPaint = 0;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let dpr = 1;

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect?.() || { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
      canvasWidth = Math.max(1, rect.width || 1);
      canvasHeight = Math.max(1, rect.height || 1);
      dpr = Math.min(latestRef.current.isImmersive ? 1.45 : 1.25, window.devicePixelRatio || 1);
      const targetWidth = Math.floor(canvasWidth * dpr);
      const targetHeight = Math.floor(canvasHeight * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
    };

    const draw = (time = 0) => {
      const seconds = time / 1000;
      if (gl && resources) {
        drawWebglScene(gl, resources, latestRef.current, canvasWidth, canvasHeight, dpr, seconds);
      } else if (fallbackContext) {
        drawFallback2d(fallbackContext, latestRef.current, canvasWidth, canvasHeight, dpr, seconds);
      }
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const frameMs = latestRef.current.isImmersive ? 24 : 32;
    const tick = (time = 0) => {
      if (time - lastPaint >= frameMs || !lastPaint) {
        draw(time);
        lastPaint = time;
      }
      if (!reducedMotion) raf = window.requestAnimationFrame(tick);
    };

    resize();
    draw(performance.now());
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      resize();
      draw(performance.now());
    }) : null;
    if (canvas.parentElement) observer?.observe(canvas.parentElement);
    if (!reducedMotion) raf = window.requestAnimationFrame(tick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  const graphPointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect) return null;
    const metrics = viewboxMetrics(Math.max(1, rect.width), Math.max(1, rect.height));
    const viewX = (event.clientX - rect.left - metrics.offsetX) / metrics.fitScale;
    const viewY = (event.clientY - rect.top - metrics.offsetY) / metrics.fitScale;
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
