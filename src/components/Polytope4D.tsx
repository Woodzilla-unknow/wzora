"use client";

import { useEffect, useRef, useState } from "react";

/*
 * A wireframe 4D polytope, rotated in four dimensions and projected down to
 * the screen. Edges are drawn as lines; faces get a faint fill whose strength
 * shifts as the shape turns, so the surface keeps changing with the motion.
 *
 * Optionally drives the tone of other elements (the WZORA letters): the shape is
 * split into vertical bands, one per element, and each element takes the
 * brightness of its band — so the word lights up wherever the surfaces do.
 *
 * The polytope depends on the screen size:
 *   phones   → 8-cell  (tesseract)
 *   tablets  → 16-cell
 *   desktops → 24-cell
 */

type Vec4 = [number, number, number, number];
type Shape = {
  name: string;
  vertices: Vec4[];
  edges: [number, number][];
  faces: number[][];
};

function normalize(vs: Vec4[]): Vec4[] {
  const r = Math.hypot(...vs[0]);
  return vs.map((v) => v.map((c) => c / r) as Vec4);
}

/** Pairs of vertices at the shortest distance apart. */
function shortestEdges(vs: Vec4[]): [number, number][] {
  const dist = (a: Vec4, b: Vec4) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  let min = Infinity;
  for (let i = 0; i < vs.length; i++)
    for (let j = i + 1; j < vs.length; j++) min = Math.min(min, dist(vs[i], vs[j]));
  const edges: [number, number][] = [];
  for (let i = 0; i < vs.length; i++)
    for (let j = i + 1; j < vs.length; j++)
      if (Math.abs(dist(vs[i], vs[j]) - min) < 1e-6) edges.push([i, j]);
  return edges;
}

/** Every triple of mutually connected vertices. */
function triangles(n: number, edges: [number, number][]): number[][] {
  const adj = new Set(edges.map(([a, b]) => `${a},${b}`));
  const has = (a: number, b: number) => adj.has(a < b ? `${a},${b}` : `${b},${a}`);
  const out: number[][] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      if (has(a, b))
        for (let c = b + 1; c < n; c++) if (has(a, c) && has(b, c)) out.push([a, b, c]);
  return out;
}

function tesseract(): Shape {
  const vertices: Vec4[] = [];
  for (let i = 0; i < 16; i++)
    vertices.push([0, 1, 2, 3].map((b) => ((i >> b) & 1 ? 1 : -1)) as Vec4);
  const edges = shortestEdges(vertices);
  // Square faces: two axes vary, the other two are fixed.
  const faces: number[][] = [];
  for (let a = 0; a < 4; a++)
    for (let b = a + 1; b < 4; b++)
      for (let base = 0; base < 16; base++) {
        if (base & ((1 << a) | (1 << b))) continue;
        faces.push([base, base | (1 << a), base | (1 << a) | (1 << b), base | (1 << b)]);
      }
  return { name: "8-cell · Tesseract", vertices: normalize(vertices), edges, faces };
}

function sixteenCell(): Shape {
  const vertices: Vec4[] = [];
  for (let axis = 0; axis < 4; axis++)
    for (const s of [1, -1]) {
      const v: Vec4 = [0, 0, 0, 0];
      v[axis] = s;
      vertices.push(v);
    }
  const edges = shortestEdges(vertices);
  return { name: "16-cell · Hexadecachoron", vertices, edges, faces: triangles(vertices.length, edges) };
}

function twentyFourCell(): Shape {
  const vertices: Vec4[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++)
      for (const si of [1, -1])
        for (const sj of [1, -1]) {
          const v: Vec4 = [0, 0, 0, 0];
          v[i] = si;
          v[j] = sj;
          vertices.push(v);
        }
  const edges = shortestEdges(vertices);
  return {
    name: "24-cell · Icositetrachoron",
    vertices: normalize(vertices),
    edges,
    faces: triangles(vertices.length, edges),
  };
}

function shapeForWidth(width: number): Shape {
  if (width < 640) return tesseract();
  if (width < 1100) return sixteenCell();
  return twentyFourCell();
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

type Props = {
  className?: string;
  /** Elements matching this selector get a `--tone` (0–1) that follows the shape. */
  toneSelector?: string;
};

export function Polytope4D({ className, toneSelector }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let shape = shapeForWidth(window.innerWidth);
    setName(shape.name);

    let size = 0;
    let dpr = 1;
    let rgb = readColor(document.documentElement);
    let frame = 0;
    let visible = true;
    let t = reducedMotion ? 2.2 : 0;
    let last = performance.now();
    const toneEls = toneSelector
      ? Array.from(document.querySelectorAll<HTMLElement>(toneSelector))
      : [];
    const tones = toneEls.map(() => 1);
    // Horizontal centre and half-width of each tone element, in canvas pixels.
    let toneSpans: { x: number; half: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // The shape is sized off the longer side so it spills past the screen edges.
      size = Math.max(rect.width, rect.height);
      toneSpans = toneEls.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: (r.left + r.width / 2 - rect.left) * dpr, half: (r.width / 2) * dpr };
      });
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const next = shapeForWidth(window.innerWidth);
      if (next.name !== shape.name) {
        shape = next;
        setName(next.name);
      }
      draw();
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
      const projected = shape.vertices.map((src) => {
        const v = [...src] as Vec4;
        rotate(v, 0, 3, t * 0.31); // XW
        rotate(v, 1, 3, t * 0.23); // YW
        rotate(v, 2, 3, t * 0.17); // ZW
        rotate(v, 0, 1, t * 0.11); // XY
        const k4 = 3 / (3 - v[3]);
        let x = v[0] * k4;
        let y = v[1] * k4;
        let z = v[2] * k4;
        // A gentle 3D tilt so the projection never looks flat.
        const tilt = 0.45 + Math.sin(t * 0.2) * 0.15;
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        z = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = y2;
        const k3 = 6 / (6 - z);
        return { x: cx + x * k3 * scale, y: cy + y * k3 * scale, X: x, Y: y, Z: z, W: v[3] };
      });

      // Surfaces: shade each face by how it faces a light that circles over time,
      // modulated by a wave travelling through the fourth dimension.
      const lx = Math.cos(t * 0.6);
      const ly = Math.sin(t * 0.45) * 0.6;
      const lz = Math.sin(t * 0.6);
      const ll = Math.hypot(lx, ly, lz);
      const faces = shape.faces.map((f) => {
        const p = f.map((i) => projected[i]);
        const ux = p[1].X - p[0].X, uy = p[1].Y - p[0].Y, uz = p[1].Z - p[0].Z;
        const vx = p[2].X - p[0].X, vy = p[2].Y - p[0].Y, vz = p[2].Z - p[0].Z;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        const light = Math.abs((nx * lx + ny * ly + nz * lz) / (nl * ll));
        const wAvg = p.reduce((s, q) => s + q.W, 0) / p.length;
        const zAvg = p.reduce((s, q) => s + q.Z, 0) / p.length;
        const wave = 0.5 + 0.5 * Math.sin(t * 1.1 + wAvg * 4);
        return { p, z: zAvg, alpha: 0.01 + 0.12 * light * light * wave };
      });
      faces.sort((a, b) => a.z - b.z);
      for (const f of faces) {
        ctx.beginPath();
        ctx.moveTo(f.p[0].x, f.p[0].y);
        for (let i = 1; i < f.p.length; i++) ctx.lineTo(f.p[i].x, f.p[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${r},${g},${b},${f.alpha.toFixed(3)})`;
        ctx.fill();
      }

      // Edges: brighter and thicker the nearer they sit in the fourth dimension.
      ctx.lineCap = "round";
      for (const [i, j] of shape.edges) {
        const a = projected[i];
        const c = projected[j];
        const depth = ((a.W + c.W) / 2 + 1) / 2;
        ctx.strokeStyle = `rgba(${r},${g},${b},${(0.14 + 0.66 * depth).toFixed(3)})`;
        ctx.lineWidth = (0.6 + depth * 1.4) * dpr;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }

      updateTones(faces);

      // Vertices.
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      for (const p of projected) {
        const rad = (1 + ((p.W + 1) / 2) * 2.4) * dpr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Each tone element takes the brightness of the lit surfaces passing
    // behind it: faces near its horizontal centre count the most.
    const updateTones = (faces: { p: { x: number }[]; alpha: number }[]) => {
      const n = toneEls.length;
      if (!n) return;
      const bins = new Array<number>(n).fill(0);
      for (const f of faces) {
        const x = f.p.reduce((sum, q) => sum + q.x, 0) / f.p.length;
        for (let i = 0; i < n; i++) {
          const d = (x - toneSpans[i].x) / (toneSpans[i].half * 1.5);
          bins[i] += f.alpha * Math.exp(-d * d);
        }
      }
      const max = Math.max(...bins) || 1;
      for (let i = 0; i < n; i++) {
        const target = 0.3 + 0.7 * (bins[i] / max);
        const next = reducedMotion ? target : tones[i] + (target - tones[i]) * 0.08;
        if (Math.abs(next - tones[i]) > 0.002 || reducedMotion) {
          tones[i] = next;
          toneEls[i].style.setProperty("--tone", next.toFixed(3));
        }
      }
    };

    const loop = (now: number) => {
      t += Math.min(now - last, 50) / 1000;
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
    // Letter widths change once the web font loads, so re-measure then too.
    toneEls.forEach((el) => ro.observe(el));
    resize();
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", updateColor);
      document.removeEventListener("visibilitychange", onVisibility);
      toneEls.forEach((el) => el.style.removeProperty("--tone"));
    };
  }, [toneSelector]);

  return (
    <figure className={className}>
      <canvas ref={canvasRef} className="polytope-canvas" aria-hidden="true" />
      <figcaption className="polytope-name" aria-hidden="true">
        {name}
      </figcaption>
    </figure>
  );
}
