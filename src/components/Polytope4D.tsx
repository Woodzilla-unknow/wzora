"use client";

import { useEffect, useRef, useState } from "react";
import { AXIS, POINT, SHAPE_BUILT, edgeGrowth, openAxes, shapeBuildTime } from "@/components/startup";

/*
 * A wireframe 4D polytope, turning continuously in four dimensions and
 * projected down to the screen. Only the edges are drawn, as lines on the
 * plain background.
 *
 * Shapes: the 5-cell, 8-cell (tesseract), 16-cell and 24-cell. The last three
 * share one set of 24 points in 4D (the 24-cell's vertices are exactly the
 * 8-cell's plus the 16-cell's). Changing the `shape` prop morphs the shape:
 * edges retract into and grow out of shared vertices (or their midpoints)
 * instead of jumping. Without a `shape` prop it picks one by screen width.
 *
 * Auto-fit: every frame the shape scales and moves itself to fill the box of
 * the `fitSelector` element (or the whole canvas below `fitTop`), so it is
 * never cropped; it glides when that box moves or changes size.
 *
 * The lines also split the screen into regions, coloured alternately like a
 * checkerboard (each line flips the colour). The "white" regions are filled
 * with a field of dots, clipped exactly at the lines: full-size deep inside,
 * shrinking and flickering towards the borders, so black and white look like
 * they are fighting over the surface. Wherever a white region passes behind
 * the `revealSelector` element (the solid WZORA layer), that part of it shows
 * through a clip path.
 *
 * With `build`, the shape takes part in the first-visit start-up: while it
 * runs, a tesseract builds itself here from a single point, one dimension at
 * a time (see startup.ts), sized and lit exactly as the finished shape, so
 * the start-up ends in the shape that then simply carries on turning.
 */

type Vec4 = [number, number, number, number];
export type ShapeId = "5-cell" | "tesseract" | "16-cell" | "24-cell";

const NAMES: Record<ShapeId, string> = {
  "5-cell": "5-cell · Pentachoron",
  tesseract: "8-cell · Tesseract",
  "16-cell": "16-cell · Hexadecachoron",
  "24-cell": "24-cell · Icositetrachoron",
};

function shapeForWidth(width: number): ShapeId {
  if (width < 640) return "tesseract";
  if (width < 1100) return "16-cell";
  return "24-cell";
}

// Vertices, all on the unit 3-sphere:
//   0–7    ±1 on one axis       (the 16-cell)
//   8–23   ±½ on every axis     (the 8-cell)
//   24–28  a regular simplex    (the 5-cell)
const VERTICES: Vec4[] = [];
for (let axis = 0; axis < 4; axis++)
  for (const s of [1, -1]) {
    const v: Vec4 = [0, 0, 0, 0];
    v[axis] = s;
    VERTICES.push(v);
  }
for (let bits = 0; bits < 16; bits++)
  VERTICES.push([0, 1, 2, 3].map((b) => ((bits >> b) & 1 ? 0.5 : -0.5)) as Vec4);
const W5 = 1 / Math.sqrt(5);
for (const v of [[1, 1, 1, -W5], [1, -1, -1, -W5], [-1, 1, -1, -W5], [-1, -1, 1, -W5], [0, 0, 0, 4 * W5]])
  VERTICES.push(v.map((c) => c / Math.sqrt(3.2)) as Vec4);

const axisVertex = (axis: number, sign: number) => axis * 2 + (sign > 0 ? 0 : 1);
const halfVertex = (bits: number) => 8 + bits;
const simplexVertex = (i: number) => 24 + i;
const isHalfVertex = (i: number) => i >= 8 && i < 24;

// The tesseract's corner `bits` part-way through the start-up's build: along
// each axis already opening, as far out as its edge has grown; flat on the rest.
const builtCorner = (bits: number, s: number, axes: number) =>
  VERTICES[halfVertex(bits)].map((c, k) => (k < axes ? c * edgeGrowth(s, k, bits & ((1 << k) - 1)) : 0)) as Vec4;

// The first square of the build (corners 00, 01, 11, 10), whose face fills with dots.
const BUILD_SQUARE = [0, 1, 3, 2].map(halfVertex);

/**
 * One closed walk that uses every edge exactly once (every vertex here has even
 * degree). Filled with the even-odd rule, it colours the regions between the
 * lines alternately.
 */
function eulerCircuit(edges: [number, number][]): number[] {
  const adj = new Map<number, { to: number; id: number }[]>();
  edges.forEach(([a, b], id) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, id });
    adj.get(b)!.push({ to: a, id });
  });
  const used = new Uint8Array(edges.length);
  const next = new Map<number, number>();
  const stack = [edges[0][0]];
  const circuit: number[] = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    const list = adj.get(v)!;
    let i = next.get(v) ?? 0;
    while (i < list.length && used[list[i].id]) i++;
    next.set(v, i);
    if (i < list.length) {
      used[list[i].id] = 1;
      stack.push(list[i].to);
    } else {
      circuit.push(stack.pop()!);
    }
  }
  return circuit;
}

function buildShapes(): Record<ShapeId, [number, number][]> {
  // 5-cell: every pair of its five points.
  const simplexEdges: [number, number][] = [];
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++) simplexEdges.push([simplexVertex(i), simplexVertex(j)]);

  // 8-cell: ±½ points that differ in one sign.
  const cubeEdges: [number, number][] = [];
  for (let bits = 0; bits < 16; bits++)
    for (let b = 0; b < 4; b++)
      if (!((bits >> b) & 1)) cubeEdges.push([halfVertex(bits), halfVertex(bits | (1 << b))]);

  // 16-cell: every pair of axis points that are not opposite.
  const crossEdges: [number, number][] = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) if (i >> 1 !== j >> 1) crossEdges.push([i, j]);

  // 24-cell: the 8-cell's edges plus each axis point joined to the 8 half points on its side.
  const spokeEdges: [number, number][] = [];
  for (let axis = 0; axis < 4; axis++)
    for (const s of [1, -1])
      for (let bits = 0; bits < 16; bits++)
        if (((bits >> axis) & 1 ? 1 : -1) === s)
          spokeEdges.push([axisVertex(axis, s), halfVertex(bits)]);

  return {
    "5-cell": simplexEdges,
    tesseract: cubeEdges,
    "16-cell": crossEdges,
    "24-cell": [...cubeEdges, ...spokeEdges],
  };
}

/** Rotate `v` in the plane spanned by axes `i` and `j`. */
function rotate(v: Vec4, i: number, j: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const a = v[i];
  const b = v[j];
  v[i] = a * c - b * s;
  v[j] = a * s + b * c;
}

function readColor(el: Element): [number, number, number] {
  const fg = getComputedStyle(el).getPropertyValue("--fg").trim();
  return fg === "#000000" || fg === "#000" ? [0, 0, 0] : [255, 255, 255];
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Morph timing, in seconds.
const EDGE_DURATION = 1.4;
const MAX_STAGGER = 1.1;

// Auto-fit: CSS pixels kept clear inside the fit box, and how fast (seconds)
// the shape shrinks to avoid overflowing, grows into free space, or moves.
const FIT_MARGIN = 30;
const FIT_SHRINK = 0.25;
const FIT_GROW = 1.2;
const FIT_MOVE = 0.35;

// Dot field: one dot per DOT_SPACING CSS pixels, at most DOT_MAX × spacing in radius.
const DOT_SPACING = 11;
const DOT_MAX = 0.4;

/** Two-pass box blur of a w×h grid, in place (`tmp` is scratch space). */
function blur(grid: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += grid[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = sum / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      grid[y * w + x] = sum / n;
    }
}

type Props = {
  className?: string;
  /** Which polytope to show; changing it morphs to the new one. Defaults to one chosen by screen width. */
  shape?: ShapeId;
  /** Element whose box the shape fits into. Defaults to the whole canvas below `fitTop`. */
  fitSelector?: string;
  /** Element revealed (via clip-path) wherever a "solid" region passes behind it. */
  revealSelector?: string;
  /** CSS pixels at the top covered by something else (a fixed header), kept out of the fit. */
  fitTop?: number;
  /** While false (hidden behind another scene), the shape pauses. */
  active?: boolean;
  /** Build itself in step with the first-visit start-up whenever one is running. */
  build?: boolean;
};

export function Polytope4D({
  className,
  shape,
  fitSelector,
  revealSelector,
  fitTop = 0,
  active = true,
  build = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const [name, setName] = useState("");
  // Props read every frame without restarting the animation.
  const shapeRef = useRef(shape);
  const fitRef = useRef(fitSelector);
  const activeRef = useRef(active);
  activeRef.current = active;
  const buildRef = useRef(build);
  buildRef.current = build;
  const controls = useRef<{ setShape: (id: ShapeId) => void } | null>(null);
  shapeRef.current = shape;
  fitRef.current = fitSelector;

  useEffect(() => {
    if (shape) controls.current?.setShape(shape);
  }, [shape]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reveal = revealSelector ? document.querySelector<HTMLElement>(revealSelector) : null;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Union of every shape's edges; each edge fades in and out on its own.
    const shapes = buildShapes();
    const edgeIndex = new Map<string, number>();
    const edges: [number, number][] = [];
    const edgeId = (a: number, b: number) => {
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      let i = edgeIndex.get(key);
      if (i === undefined) {
        i = edges.length;
        edgeIndex.set(key, i);
        edges.push([a, b]);
      }
      return i;
    };
    const ids = Object.keys(shapes) as ShapeId[];
    const shapeEdges = {} as Record<ShapeId, Set<number>>;
    const circuits = {} as Record<ShapeId, number[]>;
    for (const id of ids) {
      shapeEdges[id] = new Set(shapes[id].map(([a, b]) => edgeId(a, b)));
      circuits[id] = eulerCircuit(shapes[id]);
    }

    const E = edges.length;
    const presence = new Float32Array(E); // 0 = gone, 1 = fully drawn
    const target = new Uint8Array(E);
    const delay = new Float32Array(E);
    const anchor = new Int16Array(E).fill(-1); // vertex an edge grows from; -1 = its midpoint
    const eased = new Float32Array(E);
    const vertexPresence = new Float32Array(VERTICES.length);

    let current: ShapeId | null = null;
    const setShape = (next: ShapeId, instant: boolean) => {
      if (next === current) return;
      const before = new Set<number>();
      const after = new Set<number>();
      for (let e = 0; e < E; e++) {
        if (target[e]) before.add(edges[e][0]).add(edges[e][1]);
        if (shapeEdges[next].has(e)) after.add(edges[e][0]).add(edges[e][1]);
      }
      const stays = (v: number) => before.has(v) && after.has(v);
      for (let e = 0; e < E; e++) {
        const t = shapeEdges[next].has(e) ? 1 : 0;
        if (t === target[e]) continue;
        target[e] = t;
        delay[e] = instant ? 0 : Math.random() * MAX_STAGGER;
        if (instant) presence[e] = t;
        // Grow out of (or retract into) a vertex both shapes share, if there is one.
        const [a, b] = edges[e];
        anchor[e] = stays(a) && !stays(b) ? a : stays(b) && !stays(a) ? b : -1;
      }
      current = next;
      setName(NAMES[next]);
    };
    const wantedShape = () => shapeRef.current ?? shapeForWidth(window.innerWidth);
    setShape(wantedShape(), reducedMotion);

    let fit = 0; // current scale, device pixels per unit
    let fx = 0; // current centre, device pixels
    let fy = 0;
    let snapFit = true; // jump straight to the fitted size and place (first frame, resize)
    let lastDt = 0;
    let dpr = 1;
    let rgb = readColor(document.documentElement);
    let frame = 0;
    let visible = true;
    let t = reducedMotion ? 2.2 : 0;
    let last = performance.now();
    let wasBuilding = false;

    // Low-res grid, one cell per dot, that the white regions are drawn into.
    const field = document.createElement("canvas");
    const fctx = field.getContext("2d", { willReadFrequently: true });
    let gw = 0;
    let gh = 0;
    let inside = new Float32Array(0);
    let soft = new Float32Array(0);
    let scratch = new Float32Array(0);
    let phase = new Float32Array(0);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      snapFit = true;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gw = Math.ceil(rect.width / DOT_SPACING);
      gh = Math.ceil(rect.height / DOT_SPACING);
      field.width = gw;
      field.height = gh;
      inside = new Float32Array(gw * gh);
      soft = new Float32Array(gw * gh);
      scratch = new Float32Array(gw * gh);
      phase = Float32Array.from({ length: gw * gh }, () => Math.random() * Math.PI * 2);
      setShape(wantedShape(), reducedMotion);
      draw();
    };

    /** The box to fit the shape into, in canvas device pixels. */
    const fitBox = () => {
      const cr = canvas.getBoundingClientRect();
      const el = fitRef.current ? document.querySelector(fitRef.current) : null;
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0)
        return { x: (r.left - cr.left) * dpr, y: (r.top - cr.top) * dpr, w: r.width * dpr, h: r.height * dpr };
      return { x: 0, y: fitTop * dpr, w: canvas.width, h: canvas.height - fitTop * dpr };
    };

    const step = (dt: number) => {
      t += dt;
      lastDt = dt;
      for (let e = 0; e < E; e++) {
        if (presence[e] === target[e]) continue;
        if (delay[e] > 0) {
          delay[e] -= dt;
          continue;
        }
        const d = dt / EDGE_DURATION;
        presence[e] = target[e] ? Math.min(1, presence[e] + d) : Math.max(0, presence[e] - d);
      }
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const [r, g, b] = rgb;

      // The start-up's build, if one is running: `s` seconds in, `axes` axes opening.
      const s = buildRef.current ? shapeBuildTime(performance.now()) : null;
      const building = s !== null && s < SHAPE_BUILT;
      if (building && !wasBuilding) {
        setShape("tesseract", true);
        snapFit = true;
      }
      wasBuilding = building;
      if (building && s < 0) {
        // Not yet: the start-up screen is still turning its loading bar into the point.
        if (reveal) reveal.style.opacity = "0";
        return;
      }
      const axes = building ? openAxes(s) : 4;

      vertexPresence.fill(0);
      if (building) {
        // Only the part built so far: the corners (and edges between them) whose
        // bits use the opened axes alone.
        const corners = 1 << axes;
        for (let e = 0; e < E; e++) {
          const [a, c] = edges[e];
          eased[e] = shapeEdges.tesseract.has(e) && a - 8 < corners && c - 8 < corners ? 1 : 0;
        }
        for (let bits = 0; bits < corners; bits++) vertexPresence[halfVertex(bits)] = 1;
      } else {
        for (let e = 0; e < E; e++) {
          eased[e] = easeInOut(presence[e]);
          const [a, c] = edges[e];
          vertexPresence[a] = Math.max(vertexPresence[a], eased[e]);
          vertexPresence[c] = Math.max(vertexPresence[c], eased[e]);
        }
      }

      // Rotate in 4D, then perspective-project 4D → 3D → 2D (in units for now).
      const tilt = 0.45 + Math.sin(t * 0.2) * 0.15;
      const project = (src: Vec4) => {
        const v = [...src] as Vec4;
        rotate(v, 0, 3, t * 0.31); // XW
        rotate(v, 1, 3, t * 0.23); // YW
        rotate(v, 2, 3, t * 0.17); // ZW
        rotate(v, 0, 1, t * 0.11); // XY
        const k4 = 3 / (3 - v[3]);
        const x = v[0] * k4;
        let y = v[1] * k4;
        let z = v[2] * k4;
        // A gentle 3D tilt so the projection never looks flat.
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        z = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = y2;
        const k3 = 6 / (6 - z);
        return { u: x * k3, v: y * k3, X: x, Y: y, Z: z, W: v[3] };
      };
      const full = VERTICES.map(project);
      const unit = building
        ? VERTICES.map((src, i) => (isHalfVertex(i) ? project(builtCorner(i - 8, s, axes)) : full[i]))
        : full;

      // Auto-fit: scale and move the shape's current outline into the fit box.
      // While building, fit the finished tesseract, so the build grows into its size.
      let ex = 0.3;
      let ey = 0.3;
      full.forEach((p, i) => {
        if ((building ? Number(isHalfVertex(i)) : vertexPresence[i]) < 0.05) return;
        ex = Math.max(ex, Math.abs(p.u));
        ey = Math.max(ey, Math.abs(p.v));
      });
      const box = fitBox();
      const margin = FIT_MARGIN * dpr;
      const want = Math.max(0, Math.min((box.w / 2 - margin) / ex, (box.h / 2 - margin) / ey));
      const tx = box.x + box.w / 2;
      const ty = box.y + box.h / 2;
      if (snapFit || !fit) {
        fit = want;
        fx = tx;
        fy = ty;
      } else {
        fit += (want - fit) * (1 - Math.exp(-lastDt / (want < fit ? FIT_SHRINK : FIT_GROW)));
        const k = 1 - Math.exp(-lastDt / FIT_MOVE);
        fx += (tx - fx) * k;
        fy += (ty - fy) * k;
      }
      snapFit = false;

      const projected = unit.map((p) => ({ ...p, x: fx + p.u * fit, y: fy + p.v * fit }));

      // The white regions belong to whichever shape is most present. Mid-morph,
      // they fade out and back in as one shape hands over to the next.
      let circuit: number[];
      let strength: number;
      if (building) {
        // While building: the square fills with dots, the cube is bare wire (its
        // square's dots fading), and the tesseract's checkerboard emerges as its
        // two cubes pull apart.
        circuit = axes < 4 ? BUILD_SQUARE : circuits.tesseract;
        strength = axes < 2 ? 0 : axes === 3 ? 1 - smoothstep(0, 0.6, s - POINT - 2 * AXIS) : 1;
      } else {
        let best: ShapeId = ids[0];
        let bestPresence = -1;
        for (const id of ids) {
          let sum = 0;
          for (const e of shapeEdges[id]) sum += eased[e];
          const p = sum / shapeEdges[id].size;
          if (p > bestPresence) [best, bestPresence] = [id, p];
        }
        strength = Math.max(0, Math.min(1, bestPresence * 2 - 1));
        circuit = circuits[best];
      }
      const regions = new Path2D();
      circuit.forEach((i, k) => {
        const { x, y } = projected[i];
        if (k) regions.lineTo(x, y);
        else regions.moveTo(x, y);
      });
      regions.closePath();

      drawDots(regions, strength, `rgb(${r},${g},${b})`);

      // Edges: brighter and thicker the nearer they sit in the fourth dimension.
      // A morphing edge is drawn partially, growing from its anchor.
      ctx.lineCap = "round";
      for (let e = 0; e < E; e++) {
        const k = eased[e];
        if (k < 0.002) continue;
        const [i, j] = edges[e];
        let a = projected[i];
        let c = projected[j];
        if (anchor[e] === j) [a, c] = [c, a];
        let x1 = a.x, y1 = a.y, x2 = c.x, y2 = c.y;
        if (k < 1) {
          if (anchor[e] === -1) {
            const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
            x1 = mx + (a.x - mx) * k; y1 = my + (a.y - my) * k;
            x2 = mx + (c.x - mx) * k; y2 = my + (c.y - my) * k;
          } else {
            x2 = a.x + (c.x - a.x) * k; y2 = a.y + (c.y - a.y) * k;
          }
        }
        const depth = ((a.W + c.W) / 2 + 1) / 2;
        ctx.strokeStyle = `rgba(${r},${g},${b},${((0.4 + 0.6 * depth) * (0.3 + 0.7 * k)).toFixed(3)})`;
        ctx.lineWidth = (0.6 + depth * 1.4) * dpr;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Vertices.
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      for (let i = 0; i < projected.length; i++) {
        const k = vertexPresence[i];
        if (k < 0.01) continue;
        const p = projected[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 + ((p.W + 1) / 2) * 2.4) * dpr * k, 0, Math.PI * 2);
        ctx.fill();
      }

      if (reveal) updateReveal(projected, circuit, strength);

      // Instrument readout: the current rotation in each plane through the fourth axis.
      if (readoutRef.current) {
        const deg = (a: number) => String(Math.round((((a * 180) / Math.PI) % 360) + 360) % 360).padStart(3, "0");
        readoutRef.current.textContent = `XW ${deg(t * 0.31)}° · YW ${deg(t * 0.23)}° · ZW ${deg(t * 0.17)}°`;
      }
    };

    // Dots fill the white regions: full-size deep inside, shrinking towards the
    // borders, where they also flicker, so the front between black and white
    // keeps shifting. They are clipped to the regions, so none crosses a line.
    const drawDots = (regions: Path2D, strength: number, color: string) => {
      if (!fctx || strength < 0.01 || !gw || !gh) return;
      const S = DOT_SPACING * dpr;
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, gw, gh);
      fctx.setTransform(1 / S, 0, 0, 1 / S, 0, 0);
      fctx.fillStyle = "#fff";
      fctx.fill(regions, "evenodd");
      const px = fctx.getImageData(0, 0, gw, gh).data;
      for (let k = 0; k < inside.length; k++) inside[k] = soft[k] = px[k * 4 + 3] / 255;
      blur(soft, scratch, gw, gh, 2);

      const maxR = S * DOT_MAX;
      ctx.beginPath();
      for (let y = 0; y < gh; y++)
        for (let x = 0; x < gw; x++) {
          const k = y * gw + x;
          if (inside[k] < 0.05) continue; // this cell is outside the white regions
          const v = soft[k];
          const front = 4 * v * (1 - v); // 1 near a border, 0 deep inside
          const flicker = 0.6 * Math.sin(t * 2.1 + phase[k]) + 0.4 * Math.sin(x * 0.55 + y * 0.45 - t * 1.3);
          const size = smoothstep(0.3, 0.9, v + 0.5 * flicker * front) * smoothstep(0.05, 0.6, inside[k]) * strength;
          if (size < 0.05) continue;
          const cx = (x + 0.5) * S;
          const cy = (y + 0.5) * S;
          const rad = maxR * size;
          ctx.moveTo(cx + rad, cy);
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        }
      ctx.save();
      ctx.clip(regions, "evenodd");
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    // Clip the reveal element to the same white regions.
    const updateReveal = (projected: { x: number; y: number }[], circuit: number[], strength: number) => {
      if (!reveal) return;
      const cr = canvas.getBoundingClientRect();
      const rr = reveal.getBoundingClientRect();
      const ox = rr.left - cr.left;
      const oy = rr.top - cr.top;
      const d = circuit
        .map((i, k) => {
          const x = (projected[i].x / dpr - ox).toFixed(1);
          const y = (projected[i].y / dpr - oy).toFixed(1);
          return `${k ? "L" : "M"}${x} ${y}`;
        })
        .join("");
      reveal.style.clipPath = `path(evenodd, "${d}Z")`;
      reveal.style.opacity = strength.toFixed(3);
    };

    const loop = (now: number) => {
      if (activeRef.current) {
        step(Math.min(now - last, 50) / 1000);
        draw();
      }
      last = now;
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reducedMotion || frame || !visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    controls.current = {
      setShape: (id) => {
        setShape(id, reducedMotion);
        if (!frame) {
          // No animation loop running (reduced motion): show the new scene at once.
          snapFit = true;
          draw();
        }
      },
    };

    // Follow theme changes (system setting or the header switch).
    const updateColor = () => {
      rgb = readColor(document.documentElement);
      draw();
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", updateColor);
    const mo = new MutationObserver(updateColor);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Only animate while on screen and the tab is visible.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    start();

    return () => {
      stop();
      controls.current = null;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", updateColor);
      document.removeEventListener("visibilitychange", onVisibility);
      reveal?.style.removeProperty("clip-path");
      reveal?.style.removeProperty("opacity");
    };
  }, [revealSelector, fitTop]);

  return (
    <figure className={className}>
      <canvas ref={canvasRef} className="polytope-canvas" aria-hidden="true" />
      <figcaption className="polytope-name" aria-hidden="true">
        <span>{name}</span>
        <span ref={readoutRef} className="polytope-readout" />
      </figcaption>
    </figure>
  );
}
