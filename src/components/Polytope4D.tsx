"use client";

import { useEffect, useRef, useState } from "react";

/*
 * A wireframe 4D polytope, rotated in four dimensions and projected down to
 * the screen. Only the edges are drawn, as lines on the plain background.
 *
 * The polytope depends on the screen width:
 *   phones   → 8-cell  (tesseract)
 *   tablets  → 16-cell
 *   desktops → 24-cell
 * All three are built on one shared set of 24 points in 4D: the 24-cell's
 * vertices are exactly the 8-cell's plus the 16-cell's. When the width crosses
 * a breakpoint, edges retract and grow between those points, so the shape
 * morphs into the next one instead of jumping.
 *
 * The lines also split the screen into regions, coloured alternately like a
 * checkerboard (each line flips the colour). Wherever a "solid" region passes
 * behind the `revealSelector` element (the solid WZORA layer), that part of it
 * shows through a clip path, so roughly half the word is solid at any moment,
 * always cut along the shape's own lines.
 */

type Vec4 = [number, number, number, number];
type ShapeId = "tesseract" | "16-cell" | "24-cell";

const NAMES: Record<ShapeId, string> = {
  tesseract: "8-cell · Tesseract",
  "16-cell": "16-cell · Hexadecachoron",
  "24-cell": "24-cell · Icositetrachoron",
};

function shapeForWidth(width: number): ShapeId {
  if (width < 640) return "tesseract";
  if (width < 1100) return "16-cell";
  return "24-cell";
}

// Shared vertices, all on the unit 3-sphere:
//   0–7   ±1 on one axis            (the 16-cell)
//   8–23  ±½ on every axis          (the 8-cell)
const VERTICES: Vec4[] = [];
for (let axis = 0; axis < 4; axis++)
  for (const s of [1, -1]) {
    const v: Vec4 = [0, 0, 0, 0];
    v[axis] = s;
    VERTICES.push(v);
  }
for (let bits = 0; bits < 16; bits++)
  VERTICES.push([0, 1, 2, 3].map((b) => ((bits >> b) & 1 ? 0.5 : -0.5)) as Vec4);

const axisVertex = (axis: number, sign: number) => axis * 2 + (sign > 0 ? 0 : 1);
const halfVertex = (bits: number) => 8 + bits;

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

// Morph timing, in seconds.
const EDGE_DURATION = 1.4;
const MAX_STAGGER = 1.1;

type Props = {
  className?: string;
  /** Element revealed (via clip-path) wherever a "solid" region passes behind it. */
  revealSelector?: string;
};

export function Polytope4D({ className, revealSelector }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState("");

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

    let shape: ShapeId | null = null;
    const setShape = (next: ShapeId, instant: boolean) => {
      if (next === shape) return;
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
      shape = next;
      setName(NAMES[next]);
    };
    setShape(shapeForWidth(window.innerWidth), reducedMotion);

    let size = 0;
    let dpr = 1;
    let rgb = readColor(document.documentElement);
    let frame = 0;
    let visible = true;
    let t = reducedMotion ? 2.2 : 0;
    let last = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Sized off the longer side so the shape spills past the screen edges.
      size = Math.max(rect.width, rect.height);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      setShape(shapeForWidth(window.innerWidth), reducedMotion);
      draw();
    };

    const step = (dt: number) => {
      t += dt;
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
      const scale = (size * dpr) / 2 / 1.25;
      const cx = w / 2;
      const cy = h / 2;

      // Rotate in 4D, then perspective-project 4D → 3D → 2D.
      const tilt = 0.45 + Math.sin(t * 0.2) * 0.15;
      const projected = VERTICES.map((src) => {
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
        return { x: cx + x * k3 * scale, y: cy + y * k3 * scale, X: x, Y: y, Z: z, W: v[3] };
      });

      vertexPresence.fill(0);
      for (let e = 0; e < E; e++) {
        eased[e] = easeInOut(presence[e]);
        const [a, c] = edges[e];
        vertexPresence[a] = Math.max(vertexPresence[a], eased[e]);
        vertexPresence[c] = Math.max(vertexPresence[c], eased[e]);
      }

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

      if (reveal) updateReveal(projected);
    };

    // Clip the reveal element to the "solid" checkerboard regions of the shape
    // that is most present. Mid-morph, the reveal fades out and back in as one
    // shape hands over to the next.
    const updateReveal = (projected: { x: number; y: number }[]) => {
      if (!reveal) return;
      let best: ShapeId = ids[0];
      let bestPresence = -1;
      for (const id of ids) {
        let sum = 0;
        for (const e of shapeEdges[id]) sum += eased[e];
        const p = sum / shapeEdges[id].size;
        if (p > bestPresence) [best, bestPresence] = [id, p];
      }
      const cr = canvas.getBoundingClientRect();
      const rr = reveal.getBoundingClientRect();
      const ox = rr.left - cr.left;
      const oy = rr.top - cr.top;
      const d = circuits[best]
        .map((i, k) => {
          const x = (projected[i].x / dpr - ox).toFixed(1);
          const y = (projected[i].y / dpr - oy).toFixed(1);
          return `${k ? "L" : "M"}${x} ${y}`;
        })
        .join("");
      reveal.style.clipPath = `path(evenodd, "${d}Z")`;
      reveal.style.opacity = Math.max(0, Math.min(1, bestPresence * 2 - 1)).toFixed(3);
    };

    const loop = (now: number) => {
      step(Math.min(now - last, 50) / 1000);
      last = now;
      draw();
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
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", updateColor);
      document.removeEventListener("visibilitychange", onVisibility);
      reveal?.style.removeProperty("clip-path");
      reveal?.style.removeProperty("opacity");
    };
  }, [revealSelector]);

  return (
    <figure className={className}>
      <canvas ref={canvasRef} className="polytope-canvas" aria-hidden="true" />
      <figcaption className="polytope-name" aria-hidden="true">
        {name}
      </figcaption>
    </figure>
  );
}
