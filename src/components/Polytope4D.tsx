"use client";

import { useEffect, useRef, useState } from "react";

/*
 * A wireframe 4D polytope, rotated in four dimensions and projected down to
 * the screen. Only the edges are drawn, as lines on the plain background.
 *
 * Inside a `[data-scroll-track]` element (the front page hero), scrolling
 * drives the scene instead of the clock: at the top only the vertices show;
 * scrolling draws the edges in, then lets the dots in, then turns the shape
 * through 4D. Scrolling back plays it in reverse, and nothing moves until the
 * visitor scrolls. Outside a track, the shape simply turns on its own.
 *
 * The shape resizes itself every frame to the largest size that still fits
 * the visible area, so it is never cropped on any screen: it shrinks quickly
 * when its turning outline is about to overflow and grows back slowly.
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
 * checkerboard (each line flips the colour). The "white" regions are filled
 * with a field of dots: full-size deep inside, shrinking and flickering along
 * the borders, so black and white look like they are fighting over the
 * surface. Wherever a white region passes behind the `revealSelector` element
 * (the solid WZORA layer), that part of it shows through a clip path, so part
 * of the word is solid at any moment, cut along the shape's own lines.
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

// Scroll timeline, as fractions of the scroll track.
const ASSEMBLE_END = 0.15; // edges fully drawn
const DOTS_START = 0.12; // dots begin to appear…
const DOTS_END = 0.32; // …and are fully in
const T_START = 2; // orientation at the top of the page
const T_RANGE = 24; // how far the shape turns over the whole track
const SCROLL_EASE = 0.18; // seconds the shape takes to catch up with the scroll

// Auto-fit: CSS pixels kept clear around the shape, and how fast (seconds)
// it shrinks to avoid overflowing or grows back into free space.
const FIT_MARGIN = 30;
const FIT_SHRINK = 0.25;
const FIT_GROW = 1.2;

// Dot field: one dot per DOT_SPACING CSS pixels, at most DOT_MAX × spacing in radius.
const DOT_SPACING = 11;
const DOT_MAX = 0.4;

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

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
  /** Element revealed (via clip-path) wherever a "solid" region passes behind it. */
  revealSelector?: string;
  /** CSS pixels at the top covered by something else (a fixed header), kept out of the fit. */
  fitTop?: number;
};

export function Polytope4D({ className, revealSelector, fitTop = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
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

    let fit = 0; // current scale, device pixels per unit
    let snapFit = true; // jump straight to the fitted size (first frame, resize)
    let lastDt = 0;
    let dpr = 1;
    let rgb = readColor(document.documentElement);
    let frame = 0;
    let visible = true;
    let last = performance.now();

    // Scroll-driven when inside a scroll track; otherwise driven by the clock.
    const track = canvas.closest<HTMLElement>("[data-scroll-track]");
    const readProgress = () => {
      if (!track) return 1;
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    };
    let progress = readProgress();
    let t = track ? T_START + progress * T_RANGE : reducedMotion ? 2.2 : 0;
    let fitSettled = false;

    // Low-res grid, one cell per dot, that the white regions are drawn into.
    const field = document.createElement("canvas");
    const fctx = field.getContext("2d", { willReadFrequently: true });
    let gw = 0;
    let gh = 0;
    let cover = new Float32Array(0);
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
      cover = new Float32Array(gw * gh);
      scratch = new Float32Array(gw * gh);
      phase = Float32Array.from({ length: gw * gh }, () => Math.random() * Math.PI * 2);
      setShape(shapeForWidth(window.innerWidth), reducedMotion);
      draw();
    };

    /** Advances the scene; returns whether anything changed. */
    const step = (dt: number) => {
      lastDt = dt;
      let changed = false;
      if (track) {
        const goal = readProgress();
        if (Math.abs(goal - progress) > 1e-4) {
          progress += (goal - progress) * (reducedMotion ? 1 : 1 - Math.exp(-dt / SCROLL_EASE));
          changed = true;
        } else progress = goal;
        t = T_START + progress * T_RANGE;
        track.style.setProperty("--progress", progress.toFixed(4));
      } else {
        t += dt;
        changed = true;
      }
      for (let e = 0; e < E; e++) {
        if (presence[e] === target[e]) continue;
        changed = true;
        if (delay[e] > 0) {
          delay[e] -= dt;
          continue;
        }
        const d = dt / EDGE_DURATION;
        presence[e] = target[e] ? Math.min(1, presence[e] + d) : Math.max(0, presence[e] - d);
      }
      return changed;
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const [r, g, b] = rgb;
      const cx = w / 2;
      const cy = (h + fitTop * dpr) / 2;
      // Scroll timeline: how far the edges are drawn and the dots let in.
      const assembled = track ? smoothstep(0, ASSEMBLE_END, progress) : 1;
      const dotsIn = track ? smoothstep(DOTS_START, DOTS_END, progress) : 1;

      vertexPresence.fill(0);
      for (let e = 0; e < E; e++) {
        eased[e] = easeInOut(presence[e]);
        const [a, c] = edges[e];
        vertexPresence[a] = Math.max(vertexPresence[a], eased[e]);
        vertexPresence[c] = Math.max(vertexPresence[c], eased[e]);
      }

      // Rotate in 4D, then perspective-project 4D → 3D → 2D (in units for now).
      const tilt = 0.45 + Math.sin(t * 0.2) * 0.15;
      const unit = VERTICES.map((src) => {
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
      });

      // Auto-fit: scale the shape's current outline into the free area.
      let ex = 0.3;
      let ey = 0.3;
      unit.forEach((p, i) => {
        if (vertexPresence[i] < 0.05) return;
        ex = Math.max(ex, Math.abs(p.u));
        ey = Math.max(ey, Math.abs(p.v));
      });
      const margin = FIT_MARGIN * dpr;
      const want = Math.max(0, Math.min((w / 2 - margin) / ex, (h - fitTop * dpr) / 2 / ey - margin / ey));
      if (snapFit || !fit) fit = want;
      else fit += (want - fit) * (1 - Math.exp(-lastDt / (want < fit ? FIT_SHRINK : FIT_GROW)));
      snapFit = false;
      fitSettled = Math.abs(want - fit) < 0.25;

      const projected = unit.map((p) => ({ ...p, x: cx + p.u * fit, y: cy + p.v * fit }));

      // The white regions belong to whichever shape is most present. Mid-morph,
      // they fade out and back in as one shape hands over to the next.
      let best: ShapeId = ids[0];
      let bestPresence = -1;
      for (const id of ids) {
        let sum = 0;
        for (const e of shapeEdges[id]) sum += eased[e];
        const p = sum / shapeEdges[id].size;
        if (p > bestPresence) [best, bestPresence] = [id, p];
      }
      const strength = Math.max(0, Math.min(1, bestPresence * 2 - 1)) * dotsIn;
      const circuit = circuits[best];
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
        const k = eased[e] * assembled;
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
    // keeps shifting.
    const drawDots = (regions: Path2D, strength: number, color: string) => {
      if (!fctx || strength < 0.01 || !gw || !gh) return;
      const S = DOT_SPACING * dpr;
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, gw, gh);
      fctx.setTransform(1 / S, 0, 0, 1 / S, 0, 0);
      fctx.fillStyle = "#fff";
      fctx.fill(regions, "evenodd");
      const px = fctx.getImageData(0, 0, gw, gh).data;
      for (let k = 0; k < cover.length; k++) cover[k] = px[k * 4 + 3] / 255;
      blur(cover, scratch, gw, gh, 2);

      const maxR = S * DOT_MAX;
      ctx.beginPath();
      for (let y = 0; y < gh; y++)
        for (let x = 0; x < gw; x++) {
          const k = y * gw + x;
          const v = cover[k];
          if (v < 0.02) continue;
          const front = 4 * v * (1 - v); // 1 on the border, 0 deep inside either side
          const flicker = 0.6 * Math.sin(t * 2.1 + phase[k]) + 0.4 * Math.sin(x * 0.55 + y * 0.45 - t * 1.3);
          const size = smoothstep(0.3, 0.9, v + 0.5 * flicker * front) * strength;
          if (size < 0.05) continue;
          const cx = (x + 0.5) * S;
          const cy = (y + 0.5) * S;
          const rad = maxR * size;
          ctx.moveTo(cx + rad, cy);
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        }
      ctx.fillStyle = color;
      ctx.fill();
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
      // Redraw only when something moved: the scroll, a morph, or the auto-fit.
      if (step(Math.min(now - last, 50) / 1000) || !fitSettled) draw();
      last = now;
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      // With reduced motion, only a scroll track (the visitor's own scrolling) moves it.
      if ((reducedMotion && !track) || frame || !visible || document.hidden) return;
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
      track?.style.removeProperty("--progress");
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
