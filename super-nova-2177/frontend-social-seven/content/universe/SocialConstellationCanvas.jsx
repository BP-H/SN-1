"use client";

import { useEffect, useMemo, useRef } from "react";

const VIEWBOX_WIDTH = 280;
const VIEWBOX_HEIGHT = 210;
const SCENE_CENTER_X = VIEWBOX_WIDTH / 2;
const SCENE_CENTER_Y = VIEWBOX_HEIGHT / 2;
const DUST_COUNT = 110;
const ORBIT_VERTEX_CAPACITY = 600;
const EDGE_SEGMENTS_ACTIVE = 10;
const EDGE_SEGMENTS = 6;

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
  float sphereMask = smoothstep(0.5, 0.06, dist);
  float softDisc = smoothstep(0.5, 0.38, dist);
  float shell = smoothstep(0.49, 0.36, dist) - smoothstep(0.34, 0.18, dist);
  float halo = smoothstep(0.5, 0.22, dist);
  float z = sqrt(max(0.0, 0.25 - dot(point, point))) * 2.0;
  vec3 normal = normalize(vec3(point.x * 1.4, -point.y * 1.4, z));
  vec3 lightDir = normalize(vec3(-0.34, 0.42, 0.84));
  float light = clamp(dot(normal, lightDir) * 0.5 + 0.5, 0.0, 1.0);
  float highlight = smoothstep(0.24, 0.0, length(point + vec2(0.15, 0.18)));
  float rim = pow(clamp(1.0 - z, 0.0, 1.0), 2.2) * softDisc;
  vec3 shaded = v_color.rgb * (0.38 + light * 0.92 + v_depth * 0.22);
  shaded = mix(shaded, vec3(1.0), highlight * 0.48);
  shaded += v_color.rgb * shell * 0.72;
  shaded += vec3(0.86, 0.94, 1.0) * rim * 0.34;
  float alpha = v_color.a * (sphereMask * 0.78 + halo * 0.28);
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

/* Object-form curve helpers kept for the 2D fallback and pointer hit-testing
   only; the WebGL frame path below works on flat typed arrays instead. */
function edgeCurve(edge, index = 0, isImmersive = false) {
  const source = edge.sourceNode || {};
  const target = edge.targetNode || {};
  const startX = Number(source.visualX || 0);
  const startY = Number(source.visualY || 0);
  const endX = Number(target.visualX || 0);
  const endY = Number(target.visualY || 0);
  const startDepth = Number(source.visualDepth || source.depth || 0.72);
  const endDepth = Number(target.visualDepth || target.depth || 0.72);
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
    startDepth,
    controlX: midpointX - (deltaY / distance) * sweep * side,
    controlY: midpointY + (deltaX / distance) * sweep * side * 0.76,
    controlDepth: clamp(Math.max(startDepth, endDepth) + distance / 460, 0.48, 1.18),
    endX,
    endY,
    endDepth,
  };
}

function pointOnCurve(curve, t) {
  const oneMinus = 1 - t;
  return {
    x: oneMinus * oneMinus * curve.startX + 2 * oneMinus * t * curve.controlX + t * t * curve.endX,
    y: oneMinus * oneMinus * curve.startY + 2 * oneMinus * t * curve.controlY + t * t * curve.endY,
    depth: oneMinus * oneMinus * Number(curve.startDepth || 0.72)
      + 2 * oneMinus * t * Number(curve.controlDepth || 0.78)
      + t * t * Number(curve.endDepth || 0.72),
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

function sceneCamera(time = 0, isImmersive = false, pointer = {}) {
  const pointerX = pointer.active ? clamp(Number(pointer.x || 0), -1, 1) : 0;
  const pointerY = pointer.active ? clamp(Number(pointer.y || 0), -1, 1) : 0;
  return {
    yaw: Math.sin(time * 0.17) * (isImmersive ? 0.34 : 0.2) + pointerX * (isImmersive ? 0.18 : 0.1),
    tilt: (isImmersive ? 0.46 : 0.34) + Math.cos(time * 0.13) * (isImmersive ? 0.06 : 0.035) - pointerY * 0.06,
    roll: Math.sin(time * 0.09) * (isImmersive ? 0.04 : 0.022),
    depthScale: isImmersive ? 48 : 30,
    distance: isImmersive ? 245 : 285,
    warp: isImmersive ? 9 : 5,
  };
}

/* Scalar world -> clip-space projection. Writes into `out` so the per-frame
   path never allocates. */
function projectInto(out, x, y, depth, frame) {
  const camera = frame.camera;
  const centeredX = x - SCENE_CENTER_X;
  const centeredY = y - SCENE_CENTER_Y;
  const normalizedDepth = clamp(depth || 0.72, 0.2, 1.3);
  const orbitalWarp = Math.sin(centeredX * 0.032 + centeredY * 0.026 + camera.yaw * 3.2) * camera.warp;
  const baseZ = (normalizedDepth - 0.68) * camera.depthScale + orbitalWarp;
  const yawX = centeredX * camera.cosYaw - baseZ * camera.sinYaw;
  const yawZ = centeredX * camera.sinYaw + baseZ * camera.cosYaw;
  const tiltedY = centeredY * camera.cosTilt - yawZ * camera.sinTilt;
  const tiltedZ = centeredY * camera.sinTilt + yawZ * camera.cosTilt;
  const rolledX = yawX * camera.cosRoll - tiltedY * camera.sinRoll;
  const rolledY = yawX * camera.sinRoll + tiltedY * camera.cosRoll;
  const perspective = clamp(camera.distance / Math.max(120, camera.distance - tiltedZ), 0.72, 1.46);
  const sceneX = SCENE_CENTER_X + rolledX * perspective;
  const sceneY = SCENE_CENTER_Y + rolledY * perspective;
  const screenX = frame.offsetX + (frame.viewX + sceneX * frame.viewScale) * frame.fitScale;
  const screenY = frame.offsetY + (frame.viewY + sceneY * frame.viewScale) * frame.fitScale;
  out.clipX = (screenX / frame.canvasWidth) * 2 - 1;
  out.clipY = 1 - (screenY / frame.canvasHeight) * 2;
  out.perspective = perspective;
  out.depth = clamp(0.44 + tiltedZ / 150 + normalizedDepth * 0.38, 0.16, 1.34);
}

/* Build the static graph cache once per nodes/edges change: flat typed arrays
   the frame loop can read without touching the prop objects. */
function buildGraphCache(nodes, edges, currentUser) {
  const nodeCount = nodes.length;
  const cache = {
    nodeCount,
    ids: new Array(nodeCount),
    idToIndex: new Map(),
    baseX: new Float32Array(nodeCount),
    baseY: new Float32Array(nodeCount),
    baseDepth: new Float32Array(nodeCount),
    radius: new Float32Array(nodeCount),
    coreColor: new Float32Array(nodeCount * 3),
    emphasized: new Uint8Array(nodeCount),
    animX: new Float32Array(nodeCount),
    animY: new Float32Array(nodeCount),
    animDepth: new Float32Array(nodeCount),
  };
  const lowerUser = String(currentUser || "").toLowerCase();
  nodes.forEach((node, index) => {
    cache.ids[index] = node.id;
    cache.idToIndex.set(node.id, index);
    cache.baseX[index] = Number(node.visualX || 0);
    cache.baseY[index] = Number(node.visualY || 0);
    cache.baseDepth[index] = Number(node.depth || 0.74);
    cache.radius[index] = Number(node.radius || 4);
    const palette = paletteFor(node.species);
    cache.coreColor[index * 3] = palette.core[0];
    cache.coreColor[index * 3 + 1] = palette.core[1];
    cache.coreColor[index * 3 + 2] = palette.core[2];
    cache.emphasized[index] = node.is_current || (lowerUser && node.id === lowerUser) ? 1 : 0;
  });

  const validEdges = edges.filter(
    (edge) => cache.idToIndex.has(edge.source) && cache.idToIndex.has(edge.target)
  );
  const edgeCount = validEdges.length;
  cache.edgeCount = edgeCount;
  cache.edgeIds = new Array(edgeCount);
  cache.edgeSource = new Int32Array(edgeCount);
  cache.edgeTarget = new Int32Array(edgeCount);
  cache.edgeStrength = new Float32Array(edgeCount);
  cache.edgeSourceColor = new Float32Array(edgeCount * 3);
  cache.edgeTargetColor = new Float32Array(edgeCount * 3);
  validEdges.forEach((edge, index) => {
    cache.edgeIds[index] = edge.id;
    cache.edgeSource[index] = cache.idToIndex.get(edge.source);
    cache.edgeTarget[index] = cache.idToIndex.get(edge.target);
    cache.edgeStrength[index] = clamp(Number(edge.strength || 0), 1, 90);
    const sourcePalette = paletteFor(edge.sourceNode?.species);
    const targetPalette = paletteFor(edge.targetNode?.species);
    for (let channel = 0; channel < 3; channel += 1) {
      cache.edgeSourceColor[index * 3 + channel] = sourcePalette.line[channel];
      cache.edgeTargetColor[index * 3 + channel] = targetPalette.line[channel];
    }
  });

  const lineVertexCapacity = ORBIT_VERTEX_CAPACITY + edgeCount * EDGE_SEGMENTS_ACTIVE * 2;
  cache.linePositions = new Float32Array(lineVertexCapacity * 2);
  cache.lineColors = new Float32Array(lineVertexCapacity * 4);
  const pointCapacity = DUST_COUNT + nodeCount * 3;
  cache.nodePositions = new Float32Array(pointCapacity * 2);
  cache.nodeColors = new Float32Array(pointCapacity * 4);
  cache.nodeSizes = new Float32Array(pointCapacity);
  cache.nodeDepths = new Float32Array(pointCapacity);
  return cache;
}

function createDustField() {
  const dust = {
    x: new Float32Array(DUST_COUNT),
    y: new Float32Array(DUST_COUNT),
    depth: new Float32Array(DUST_COUNT),
    phase: new Float32Array(DUST_COUNT),
    size: new Float32Array(DUST_COUNT),
  };
  for (let index = 0; index < DUST_COUNT; index += 1) {
    dust.x[index] = -24 + Math.random() * (VIEWBOX_WIDTH + 48);
    dust.y[index] = -18 + Math.random() * (VIEWBOX_HEIGHT + 36);
    dust.depth[index] = 0.25 + Math.random() * 0.9;
    dust.phase[index] = Math.random() * Math.PI * 2;
    dust.size[index] = 0.5 + Math.random() * 0.9;
  }
  return dust;
}

/* Animated node positions, written into the cache scratch arrays. Same motion
   formulas as before, minus the per-frame object clones. */
function animateNodes(cache, time, isImmersive) {
  const driftAmp = isImmersive ? 0.9 : 0.32;
  const floatAmpX = isImmersive ? 1.75 : 0.72;
  const floatAmpY = isImmersive ? 1.22 : 0.52;
  for (let index = 0; index < cache.nodeCount; index += 1) {
    const depth = cache.baseDepth[index];
    const baseX = cache.baseX[index];
    const baseY = cache.baseY[index];
    const orbitDrift = Math.sin(time * 0.16 + baseX * 0.009) * driftAmp;
    cache.animX[index] = baseX + Math.sin(time * 0.52 + baseX * 0.012 + depth) * floatAmpX * depth + orbitDrift;
    cache.animY[index] = baseY + Math.cos(time * 0.44 + baseY * 0.011 + depth) * floatAmpY * depth;
    cache.animDepth[index] = clamp(0.5 + depth * 0.34 + Math.sin(time * 0.31 + baseX * 0.018) * 0.1, 0.32, 1.18);
  }
}

const projectionScratchA = { clipX: 0, clipY: 0, perspective: 1, depth: 0.72 };
const projectionScratchB = { clipX: 0, clipY: 0, perspective: 1, depth: 0.72 };

function writeLineVertexPair(cache, cursor, a, b, r, g, bChannel, alpha) {
  const positionOffset = cursor * 2;
  const colorOffset = cursor * 4;
  cache.linePositions[positionOffset] = a.clipX;
  cache.linePositions[positionOffset + 1] = a.clipY;
  cache.linePositions[positionOffset + 2] = b.clipX;
  cache.linePositions[positionOffset + 3] = b.clipY;
  cache.lineColors[colorOffset] = r;
  cache.lineColors[colorOffset + 1] = g;
  cache.lineColors[colorOffset + 2] = bChannel;
  cache.lineColors[colorOffset + 3] = alpha;
  cache.lineColors[colorOffset + 4] = r;
  cache.lineColors[colorOffset + 5] = g;
  cache.lineColors[colorOffset + 6] = bChannel;
  cache.lineColors[colorOffset + 7] = alpha;
  return cursor + 2;
}

const ORBITS = [
  { rx: 104, ry: 38, rotate: -0.18, color: [0.66, 0.78, 1], alpha: 0.18, z: 0.76 },
  { rx: 124, ry: 54, rotate: 0.25, color: [0.66, 0.78, 1], alpha: 0.13, z: 0.62 },
  { rx: 92, ry: 72, rotate: 0.62, color: [1, 0.34, 0.64], alpha: 0.13, z: 0.82 },
  { rx: 56, ry: 94, rotate: 1.08, color: [0.72, 0.42, 1], alpha: 0.08, z: 0.54 },
];

function fillLineArrays(cache, frame, selectedEdgeId, isImmersive, time) {
  let cursor = 0;
  const orbitScale = isImmersive ? 1.18 : 1;
  for (let orbitIndex = 0; orbitIndex < ORBITS.length; orbitIndex += 1) {
    const orbit = ORBITS[orbitIndex];
    const steps = isImmersive ? 72 : 44;
    const skip = isImmersive ? 5 : 4;
    let hasPrevious = false;
    let previousX = 0;
    let previousY = 0;
    let previousDepth = 0;
    for (let step = 0; step <= steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2 + time * (0.06 + orbitIndex * 0.006) * (orbitIndex % 2 ? -1 : 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotatedX = cos * orbit.rx * orbitScale;
      const rotatedY = sin * orbit.ry * orbitScale;
      const x = SCENE_CENTER_X + rotatedX * Math.cos(orbit.rotate) - rotatedY * Math.sin(orbit.rotate);
      const y = SCENE_CENTER_Y + rotatedX * Math.sin(orbit.rotate) + rotatedY * Math.cos(orbit.rotate);
      const depth = clamp(orbit.z + sin * 0.22 + cos * 0.08, 0.25, 1.18);
      if (hasPrevious && step % skip !== 0) {
        projectInto(projectionScratchA, previousX, previousY, previousDepth, frame);
        projectInto(projectionScratchB, x, y, depth, frame);
        const depthAlpha = clamp((projectionScratchA.depth + projectionScratchB.depth) * 0.46, 0.18, 1.12);
        cursor = writeLineVertexPair(
          cache,
          cursor,
          projectionScratchA,
          projectionScratchB,
          orbit.color[0],
          orbit.color[1],
          orbit.color[2],
          orbit.alpha * depthAlpha,
        );
      }
      previousX = x;
      previousY = y;
      previousDepth = depth;
      hasPrevious = true;
    }
  }

  const sweepMin = isImmersive ? 10 : 6;
  const sweepMax = isImmersive ? 34 : 22;
  const sweepFactor = isImmersive ? 0.2 : 0.16;
  for (let index = 0; index < cache.edgeCount; index += 1) {
    const sourceIndex = cache.edgeSource[index];
    const targetIndex = cache.edgeTarget[index];
    const startX = cache.animX[sourceIndex];
    const startY = cache.animY[sourceIndex];
    const startDepth = cache.animDepth[sourceIndex];
    const endX = cache.animX[targetIndex];
    const endY = cache.animY[targetIndex];
    const endDepth = cache.animDepth[targetIndex];
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.max(1, Math.hypot(deltaX, deltaY));
    const side = index % 2 === 0 ? 1 : -1;
    const sweep = clamp(distance * sweepFactor, sweepMin, sweepMax);
    const controlX = (startX + endX) / 2 - (deltaY / distance) * sweep * side;
    const controlY = (startY + endY) / 2 + (deltaX / distance) * sweep * side * 0.76;
    const controlDepth = clamp(Math.max(startDepth, endDepth) + distance / 460, 0.48, 1.18);

    const active = selectedEdgeId === cache.edgeIds[index];
    const strength = cache.edgeStrength[index];
    const baseAlpha = active
      ? 0.74
      : clamp(0.16 + strength / 240, isImmersive ? 0.12 : 0.16, isImmersive ? 0.42 : 0.34);
    const sourceR = active ? 1 : cache.edgeSourceColor[index * 3];
    const sourceG = active ? 0.36 : cache.edgeSourceColor[index * 3 + 1];
    const sourceB = active ? 0.64 : cache.edgeSourceColor[index * 3 + 2];
    const targetR = active ? 1 : cache.edgeTargetColor[index * 3];
    const targetG = active ? 0.56 : cache.edgeTargetColor[index * 3 + 1];
    const targetB = active ? 0.75 : cache.edgeTargetColor[index * 3 + 2];
    const steps = active ? EDGE_SEGMENTS_ACTIVE : EDGE_SEGMENTS;
    /* A soft energy pulse travels each connection so the graph reads as a
       living network rather than a static wireframe. */
    const pulseT = (time * 0.22 + index * 0.137) % 1;
    const pulseGain = active ? 0.5 : 0.3;

    let previousT = 0;
    projectInto(
      projectionScratchA,
      startX,
      startY,
      startDepth,
      frame,
    );
    let previousClipX = projectionScratchA.clipX;
    let previousClipY = projectionScratchA.clipY;
    let previousDepthOut = projectionScratchA.depth;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const oneMinus = 1 - t;
      const pointX = oneMinus * oneMinus * startX + 2 * oneMinus * t * controlX + t * t * endX;
      const pointY = oneMinus * oneMinus * startY + 2 * oneMinus * t * controlY + t * t * endY;
      const pointDepth = oneMinus * oneMinus * startDepth + 2 * oneMinus * t * controlDepth + t * t * endDepth;
      projectInto(projectionScratchB, pointX, pointY, pointDepth, frame);
      const mix = t;
      const midT = (previousT + t) / 2;
      const pulse = Math.max(0, 1 - Math.abs(midT - pulseT) * 5);
      const glow = pulse * pulse * pulseGain;
      const r = Math.min(1, sourceR * (1 - mix) + targetR * mix + glow * 0.7);
      const g = Math.min(1, sourceG * (1 - mix) + targetG * mix + glow * 0.7);
      const b = Math.min(1, sourceB * (1 - mix) + targetB * mix + glow * 0.7);
      const depthAlpha = clamp((previousDepthOut + projectionScratchB.depth) * 0.46, 0.18, 1.12);
      const alpha = (baseAlpha + glow * 0.5) * depthAlpha;
      projectionScratchA.clipX = previousClipX;
      projectionScratchA.clipY = previousClipY;
      cursor = writeLineVertexPair(cache, cursor, projectionScratchA, projectionScratchB, r, g, b, alpha);
      previousClipX = projectionScratchB.clipX;
      previousClipY = projectionScratchB.clipY;
      previousDepthOut = projectionScratchB.depth;
      previousT = t;
    }
  }

  return cursor;
}

function fillNodeArrays(cache, dust, frame, selectedNodeId, isImmersive, dpr, time) {
  let cursor = 0;
  const writePoint = (clipX, clipY, r, g, b, alpha, size, depth) => {
    const positionOffset = cursor * 2;
    const colorOffset = cursor * 4;
    cache.nodePositions[positionOffset] = clipX;
    cache.nodePositions[positionOffset + 1] = clipY;
    cache.nodeColors[colorOffset] = r;
    cache.nodeColors[colorOffset + 1] = g;
    cache.nodeColors[colorOffset + 2] = b;
    cache.nodeColors[colorOffset + 3] = alpha;
    cache.nodeSizes[cursor] = size;
    cache.nodeDepths[cursor] = depth;
    cursor += 1;
  };

  /* Far star dust: tiny parallax points that give the scene real depth. */
  for (let index = 0; index < DUST_COUNT; index += 1) {
    projectInto(projectionScratchA, dust.x[index], dust.y[index], dust.depth[index], frame);
    const twinkle = 0.7 + 0.3 * Math.sin(time * 0.8 + dust.phase[index]);
    const alpha = (0.1 + dust.depth[index] * 0.16) * twinkle;
    writePoint(
      projectionScratchA.clipX,
      projectionScratchA.clipY,
      0.72,
      0.82,
      1,
      alpha,
      Math.max(1.5, dust.size[index] * (1.1 + dust.depth[index]) * dpr * frame.fitScale * 0.5),
      projectionScratchA.depth * 0.6,
    );
  }

  const selectedIndex = selectedNodeId ? cache.idToIndex.get(selectedNodeId) : undefined;
  const breath = 1 + Math.sin(time * 2.6) * 0.09;
  const layers = isImmersive
    ? [
        [7.4, 0.1, -0.08],
        [4.0, 0.32, 0.03],
        [1.55, 0.98, 0.1],
      ]
    : [
        [6.2, 0.1, -0.08],
        [3.05, 0.32, 0.03],
        [1.34, 0.98, 0.1],
      ];
  for (let layer = 0; layer < layers.length; layer += 1) {
    const [sizeMultiplier, alphaMultiplier, depthLift] = layers[layer];
    for (let index = 0; index < cache.nodeCount; index += 1) {
      const emphasized = cache.emphasized[index] === 1 || index === selectedIndex;
      projectInto(
        projectionScratchA,
        cache.animX[index],
        cache.animY[index],
        cache.animDepth[index] + depthLift,
        frame,
      );
      const boost = emphasized ? 1.35 : 1;
      /* The halo layer of the selected/current node breathes gently. */
      const pulse = emphasized && layer === 0 ? breath : 1;
      const alpha = alphaMultiplier * boost * clamp(projectionScratchA.depth, 0.36, 1.24);
      const size = Math.max(
        7,
        cache.radius[index] * 2 * frame.viewScale * frame.fitScale * dpr * sizeMultiplier * pulse
          * projectionScratchA.perspective * (0.82 + projectionScratchA.depth * 0.28),
      );
      writePoint(
        projectionScratchA.clipX,
        projectionScratchA.clipY,
        cache.coreColor[index * 3],
        cache.coreColor[index * 3 + 1],
        cache.coreColor[index * 3 + 2],
        alpha,
        size,
        projectionScratchA.depth,
      );
    }
  }

  return cursor;
}

function uploadArray(gl, buffer, location, data, count, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * size), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function drawWebglScene(gl, resources, cache, dust, latest, canvasWidth, canvasHeight, dpr, time) {
  animateNodes(cache, time, latest.isImmersive);
  const camera = sceneCamera(time, latest.isImmersive, latest.pointer);
  camera.cosYaw = Math.cos(camera.yaw);
  camera.sinYaw = Math.sin(camera.yaw);
  camera.cosTilt = Math.cos(camera.tilt);
  camera.sinTilt = Math.sin(camera.tilt);
  camera.cosRoll = Math.cos(camera.roll);
  camera.sinRoll = Math.sin(camera.roll);
  const metrics = viewboxMetrics(canvasWidth, canvasHeight);
  const frame = {
    camera,
    canvasWidth,
    canvasHeight,
    fitScale: metrics.fitScale,
    offsetX: metrics.offsetX,
    offsetY: metrics.offsetY,
    viewX: Number(latest.view?.x || 0),
    viewY: Number(latest.view?.y || 0),
    viewScale: Number(latest.view?.scale || 1),
  };

  gl.viewport(0, 0, Math.floor(canvasWidth * dpr), Math.floor(canvasHeight * dpr));
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  const lineVertexCount = fillLineArrays(cache, frame, latest.selectedEdgeId, latest.isImmersive, time);
  gl.useProgram(resources.lineProgram);
  uploadArray(gl, resources.linePositionBuffer, resources.lineLocations.position, cache.linePositions, lineVertexCount, 2);
  uploadArray(gl, resources.lineColorBuffer, resources.lineLocations.color, cache.lineColors, lineVertexCount, 4);
  gl.drawArrays(gl.LINES, 0, lineVertexCount);

  const pointCount = fillNodeArrays(cache, dust, frame, latest.selectedNodeId, latest.isImmersive, dpr, time);
  gl.useProgram(resources.nodeProgram);
  uploadArray(gl, resources.nodePositionBuffer, resources.nodeLocations.position, cache.nodePositions, pointCount, 2);
  uploadArray(gl, resources.nodeColorBuffer, resources.nodeLocations.color, cache.nodeColors, pointCount, 4);
  uploadArray(gl, resources.nodeSizeBuffer, resources.nodeLocations.size, cache.nodeSizes, pointCount, 1);
  uploadArray(gl, resources.nodeDepthBuffer, resources.nodeLocations.depth, cache.nodeDepths, pointCount, 1);
  gl.drawArrays(gl.POINTS, 0, pointCount);
}

function animatedNode(node, time, isImmersive) {
  const depth = Number(node.depth || 0.74);
  const baseX = Number(node.visualX || 0);
  const baseY = Number(node.visualY || 0);
  const orbitDrift = Math.sin(time * 0.16 + baseX * 0.009) * (isImmersive ? 0.9 : 0.32);
  const floatX = Math.sin(time * 0.52 + baseX * 0.012 + depth) * (isImmersive ? 1.75 : 0.72) * depth + orbitDrift;
  const floatY = Math.cos(time * 0.44 + baseY * 0.011 + depth) * (isImmersive ? 1.22 : 0.52) * depth;
  return {
    ...node,
    visualX: baseX + floatX,
    visualY: baseY + floatY,
    visualDepth: clamp(0.5 + depth * 0.34 + Math.sin(time * 0.31 + baseX * 0.018) * 0.1, 0.32, 1.18),
  };
}

function drawFallback2d(ctx, latest, width, height, dpr, time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const nodes = latest.nodes.map((node) => animatedNode(node, time, latest.isImmersive));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = latest.edges
    .map((edge) => ({
      ...edge,
      sourceNode: byId.get(edge.source) || edge.sourceNode,
      targetNode: byId.get(edge.target) || edge.targetNode,
    }))
    .filter((edge) => edge.sourceNode && edge.targetNode);
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
  onNodeHover,
}) {
  const canvasRef = useRef(null);
  const pointerStartRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const hoverRef = useRef({ id: "", x: 0, y: 0 });
  const dustRef = useRef(null);
  if (!dustRef.current) dustRef.current = createDustField();
  const graphCache = useMemo(() => buildGraphCache(nodes, edges, currentUser), [nodes, edges, currentUser]);
  const cacheRef = useRef(graphCache);
  cacheRef.current = graphCache;
  const latestRef = useRef({
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    currentUser,
    view,
    isImmersive,
    pointer: pointerRef.current,
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
      pointer: pointerRef.current,
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
    let visible = true;

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
        drawWebglScene(gl, resources, cacheRef.current, dustRef.current, latestRef.current, canvasWidth, canvasHeight, dpr, seconds);
      } else if (fallbackContext) {
        drawFallback2d(fallbackContext, latestRef.current, canvasWidth, canvasHeight, dpr, seconds);
      }
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const tick = (time = 0) => {
      raf = window.requestAnimationFrame(tick);
      if (!visible) return;
      /* Immersive mode renders at native refresh; the rail caps at ~60fps. */
      const frameMs = latestRef.current.isImmersive ? 0 : 16;
      if (frameMs && lastPaint && time - lastPaint < frameMs) return;
      draw(time);
      lastPaint = time;
    };

    resize();
    draw(performance.now());
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      resize();
      draw(performance.now());
    }) : null;
    if (canvas.parentElement) observer?.observe(canvas.parentElement);
    const intersection = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting !== false;
        })
      : null;
    intersection?.observe(canvas);
    if (!reducedMotion) raf = window.requestAnimationFrame(tick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
      intersection?.disconnect();
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
    for (let index = latest.nodes.length - 1; index >= 0; index -= 1) {
      const candidate = latest.nodes[index];
      const radius = Number(candidate.radius || 4) + (latest.isImmersive ? 6 : 8);
      if (Math.hypot(point.x - Number(candidate.visualX || 0), point.y - Number(candidate.visualY || 0)) <= radius) {
        return { node: candidate };
      }
    }
    const edge = latest.edges.find((candidate, index) => {
      const curve = edgeCurve(candidate, index, latest.isImmersive);
      return distanceToQuadratic(point, curve) <= (latest.isImmersive ? 4.8 : 6.5);
    });
    return { edge };
  };

  const updatePointerParallax = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect?.();
    if (!rect) return;
    pointerRef.current = {
      x: clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1),
      y: clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1, -1, 1),
      active: true,
    };
    latestRef.current.pointer = pointerRef.current;
  };

  const handlePointerDown = (event) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    updatePointerParallax(event);
    onPointerDown?.(event);
  };

  const handlePointerMove = (event) => {
    event.preventDefault();
    updatePointerParallax(event);
    const { node } = hitTest(event);
    const nextId = node?.id || "";
    const lastHover = hoverRef.current;
    const movedEnough = Math.hypot(event.clientX - lastHover.x, event.clientY - lastHover.y) > 6;
    if (nextId !== lastHover.id || (nextId && movedEnough)) {
      hoverRef.current = { id: nextId, x: event.clientX, y: event.clientY };
      onNodeHover?.(node ? { node, clientX: event.clientX, clientY: event.clientY } : null);
    }
    onPointerMove?.(event);
  };

  const handlePointerUp = (event) => {
    onPointerUp?.(event);
  };

  const handlePointerLeave = () => {
    pointerRef.current = { x: pointerRef.current.x * 0.4, y: pointerRef.current.y * 0.4, active: false };
    latestRef.current.pointer = pointerRef.current;
    hoverRef.current = { id: "", x: 0, y: 0 };
    onNodeHover?.(null);
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
      onPointerLeave={handlePointerLeave}
      onWheel={onWheel}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    />
  );
}
