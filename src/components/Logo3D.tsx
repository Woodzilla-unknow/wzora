"use client";

import { useEffect, useRef } from "react";
import { LOGO_SHAPES } from "@/components/Logo";

/*
 * The W/Z mark spinning in 3D. Stacked layers through its thickness give it
 * real depth, and like a coin it reads the right way round from either side.
 * It draws itself to fill its canvas, so the same element can be the large
 * sun of the solar system or the small mark in the corner of a scene.
 */

const LOGO_DEPTH = 70; // the mark's thickness, in logo units (it is 1440 wide)
const LAYERS = 12;
const CAMERA = 4000; // camera distance, in logo units

function readColor(): [number, number, number] {
  const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim();
  return fg === "#000000" || fg === "#000" ? [0, 0, 0] : [255, 255, 255];
}

export function Logo3D({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The mark in its own coordinates; its masks become clips ("everything but the slash").
    const [bx, by, bw, bh] = LOGO_SHAPES.box;
    const ox = bx + bw / 2;
    const oy = by + bh / 2;
    const wPath = new Path2D(`M${LOGO_SHAPES.W}Z`);
    const zPath = new Path2D(`M${LOGO_SHAPES.Z}Z`);
    const slash = new Path2D(`M${LOGO_SHAPES.slashOuter}Z M${LOGO_SHAPES.slashInner}Z`);
    const outside = (quad: string) => new Path2D(`M0 0H2000V2000H0Z M${quad}Z`);
    const notSlash = outside(LOGO_SHAPES.slashOuter);
    const notGap = outside(LOGO_SHAPES.slashGap);

    let rgb = readColor();
    let t = reducedMotion ? 0.3 : 0;
    let last = performance.now();
    let frame = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      draw();
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const [r, g, b] = rgb;
      const s = (W * 0.84) / bw; // leave room for perspective as it turns
      const cx = W / 2;
      const cy = H / 2;

      const spin = t * 0.7;
      const tilt = 0.22 * Math.sin(t * 0.5);
      const cosT = Math.cos(spin);
      const sinT = Math.sin(spin);
      const face = cosT < 0 ? -1 : 1; // seen from behind: un-mirror the mark
      const cosP = Math.cos(tilt);
      const sinP = Math.sin(tilt);
      const layers = Array.from({ length: LAYERS }, (_, i) => -LOGO_DEPTH + (2 * LOGO_DEPTH * i) / (LAYERS - 1))
        .map((z) => ({ z, depth: z * cosT * cosP }))
        .sort((a1, a2) => a1.depth - a2.depth);

      layers.forEach(({ z, depth }, i) => {
        const p = (CAMERA / (CAMERA - depth)) * s;
        // Rotate about the vertical axis, tilt about the horizontal one, project.
        const a = p * cosT * face;
        const bb = p * sinP * sinT * face;
        const d = p * cosP;
        const e = cx - a * ox + p * sinT * z;
        const f = cy - bb * ox - d * oy - p * sinP * cosT * z;
        ctx.setTransform(a, bb, 0, d, e, f);
        const cap = i === 0 || i === layers.length - 1;
        ctx.fillStyle = `rgba(${r},${g},${b},${cap ? 1 : 0.16})`;
        ctx.save();
        ctx.clip(notSlash, "evenodd");
        ctx.fill(wPath);
        ctx.restore();
        ctx.save();
        ctx.clip(notGap, "evenodd");
        ctx.fill(zPath);
        ctx.restore();
        ctx.fill(slash, "evenodd");
      });
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

    const updateColor = () => {
      rgb = readColor();
      draw();
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", updateColor);
    const mo = new MutationObserver(updateColor);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

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
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
