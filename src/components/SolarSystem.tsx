"use client";

import { useEffect, useRef } from "react";
import { LOGO_SHAPES } from "@/components/Logo";
import { companyHref, type Company } from "@/content/site";

/*
 * The front page's solar system. The W/Z mark is the sun, spinning in 3D
 * (stacked layers give it real thickness). WZORA's companies orbit it as
 * planets, each joined to the sun by a line. The more of a company WZORA
 * owns, the closer it orbits: fully owned on the inner ring, majority owned
 * on the middle ring, partners and smaller stakes on the outer ring.
 *
 * The rings are drawn as dots on a tilted plane, so planets come nearer (and
 * grow) as they swing to the front. Planets are real links laid over the
 * canvas; hovering one slows the whole system so it is easy to click.
 */

const TIERS = [
  { label: "Fully owned", radius: 0.44, speed: 0.3 },
  { label: "Majority owned", radius: 0.7, speed: 0.19 },
  { label: "Partners & stakes", radius: 0.96, speed: 0.12 },
];
const tierOf = (ownership: number) => (ownership >= 100 ? 0 : ownership >= 50 ? 1 : 2);

const ELEVATION = 0.38; // how far above the orbital plane we look from (radians)
const PERSPECTIVE = 5; // camera distance, in system radii
const SUN_WIDTH = 0.5; // the sun's width, as a fraction of the system radius
const LOGO_DEPTH = 70; // the mark's thickness, in logo units (it is 1440 wide)
const LAYERS = 12;
const DOT_GAP = 9; // CSS pixels between the dots of a ring

function readColor(): [number, number, number] {
  const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim();
  return fg === "#000000" || fg === "#000" ? [0, 0, 0] : [255, 255, 255];
}

type Props = {
  companies: Company[];
  className?: string;
  /** While false (another scene is showing), the system pauses. */
  active?: boolean;
};

export function SolarSystem({ companies, className, active = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeRef = useRef(active);
  const slowRef = useRef(false);
  activeRef.current = active;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The mark, in its own coordinates. Masks become clips: "everything but the slash".
    const [bx, by, bw, bh] = LOGO_SHAPES.box;
    const ox = bx + bw / 2;
    const oy = by + bh / 2;
    const wPath = new Path2D(`M${LOGO_SHAPES.W}Z`);
    const zPath = new Path2D(`M${LOGO_SHAPES.Z}Z`);
    const slash = new Path2D(`M${LOGO_SHAPES.slashOuter}Z M${LOGO_SHAPES.slashInner}Z`);
    const outside = (quad: string) => new Path2D(`M0 0H2000V2000H0Z M${quad}Z`);
    const notSlash = outside(LOGO_SHAPES.slashOuter);
    const notGap = outside(LOGO_SHAPES.slashGap);

    // Each planet's ring, and its starting angle spread around that ring.
    const counts = [0, 0, 0];
    const seen = [0, 0, 0];
    companies.forEach((c) => counts[tierOf(c.ownership)]++);
    const planets = companies.map((c) => {
      const tier = tierOf(c.ownership);
      const i = seen[tier]++;
      return { tier, phase: (i / counts[tier]) * Math.PI * 2 + tier * 0.9 + 0.5 };
    });

    let dpr = 1;
    let rgb = readColor();
    let t = reducedMotion ? 0.7 : 0;
    let speed = 1;
    let last = performance.now();
    let frame = 0;
    let visible = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(wrap.clientWidth * dpr);
      canvas.height = Math.round(wrap.clientHeight * dpr);
      draw();
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const [r, g, b] = rgb;
      const ink = (a: number) => `rgba(${r},${g},${b},${a.toFixed(3)})`;

      // Size the system to its box: room for planet labels at the sides and below.
      const narrow = wrap.clientWidth < 600;
      const padX = (narrow ? 50 : 90) * dpr;
      const padY = 70 * dpr;
      const sinE = Math.sin(ELEVATION);
      const cosE = Math.cos(ELEVATION);
      const R = Math.max(40 * dpr, Math.min((W / 2 - padX) / 0.96, (H / 2 - padY) / 0.45));
      const cx = W / 2;
      const cy = H / 2;

      /** A point on the orbital plane: screen position, depth (+ = nearer) and perspective scale. */
      const orbit = (angle: number, radius: number) => {
        const x3 = Math.cos(angle) * radius * R;
        const z3 = Math.sin(angle) * radius * R;
        const depth = z3 * cosE;
        const k = (PERSPECTIVE * R) / (PERSPECTIVE * R - depth);
        return { x: cx + x3 * k, y: cy + z3 * sinE * k, depth, k };
      };

      // Rings as dots, split into the half behind the sun and the half in front.
      const ringDots = (front: boolean) => {
        TIERS.forEach((tier) => {
          const n = Math.max(24, Math.round((2 * Math.PI * tier.radius * R) / (DOT_GAP * dpr)));
          for (let i = 0; i < n; i++) {
            const p = orbit((i / n) * Math.PI * 2, tier.radius);
            if (p.depth >= 0 !== front) continue;
            ctx.fillStyle = ink(front ? 0.55 : 0.25);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.1 * dpr * p.k, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      };

      const positions = planets.map((pl) =>
        orbit(pl.phase + t * TIERS[pl.tier].speed, TIERS[pl.tier].radius),
      );

      // Lines from the sun to each planet: behind first, in front after the sun.
      const links = (front: boolean) => {
        positions.forEach((p) => {
          if (p.depth >= 0 !== front) return;
          ctx.strokeStyle = ink(front ? 0.7 : 0.3);
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        });
      };

      ringDots(false);
      links(false);
      drawSun(cx, cy, ((narrow ? 0.62 : SUN_WIDTH) * R) / bw, ink);
      ringDots(true);
      links(true);

      // Ring labels, where there is room for them.
      if (R / dpr >= 180) {
        ctx.font = `500 ${10 * dpr}px ${getComputedStyle(document.body).getPropertyValue("--font-mono") || "monospace"}`;
        ctx.textBaseline = "bottom";
        TIERS.forEach((tier) => {
          const p = orbit(-Math.PI / 6, tier.radius);
          ctx.fillStyle = ink(0.6);
          ctx.fillText(tier.label.toUpperCase(), p.x + 6 * dpr, p.y - 6 * dpr);
        });
      }

      // Planets: links laid over the canvas, nearer ones larger and on top.
      positions.forEach((p, i) => {
        const el = planetRefs.current[i];
        if (!el) return;
        el.style.transform = `translate(${(p.x / dpr).toFixed(1)}px, ${(p.y / dpr).toFixed(1)}px) scale(${p.k.toFixed(3)}) translate(-50%, calc(var(--disc) / -2))`;
        el.style.zIndex = p.depth >= 0 ? "3" : "1";
        el.style.opacity = p.depth >= 0 ? "1" : (0.55 + 0.45 * p.k).toFixed(2);
      });
    };

    /**
     * The W/Z mark in 3D: layers through its thickness, drawn back to front.
     * Like a coin, it reads the right way round from either side.
     */
    const drawSun = (cx: number, cy: number, s: number, ink: (a: number) => string) => {
      const spin = t * 0.7;
      const tilt = 0.22 * Math.sin(t * 0.5);
      const cosT = Math.cos(spin);
      const sinT = Math.sin(spin);
      const face = cosT < 0 ? -1 : 1; // seen from behind: un-mirror the mark
      const cosP = Math.cos(tilt);
      const sinP = Math.sin(tilt);
      const D = 4000; // camera distance, logo units
      const layers = Array.from({ length: LAYERS }, (_, i) => -LOGO_DEPTH + (2 * LOGO_DEPTH * i) / (LAYERS - 1))
        .map((z) => ({ z, depth: z * cosT * cosP }))
        .sort((a, b2) => a.depth - b2.depth);
      layers.forEach(({ z, depth }, i) => {
        const p = (D / (D - depth)) * s;
        // Rotate about the vertical axis, tilt about the horizontal one, project.
        const a = p * cosT * face;
        const b = p * sinP * sinT * face;
        const d = p * cosP;
        const e = cx - a * ox + p * sinT * z;
        const f = cy - b * ox - d * oy - p * sinP * cosT * z;
        ctx.save();
        ctx.setTransform(a, b, 0, d, e, f);
        const cap = i === 0 || i === layers.length - 1;
        ctx.fillStyle = ink(cap ? 1 : 0.16);
        ctx.save();
        ctx.clip(notSlash, "evenodd");
        ctx.fill(wPath);
        ctx.restore();
        ctx.save();
        ctx.clip(notGap, "evenodd");
        ctx.fill(zPath);
        ctx.restore();
        ctx.fill(slash, "evenodd");
        ctx.restore();
      });
    };

    const loop = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      if (activeRef.current) {
        speed += ((slowRef.current ? 0.12 : 1) - speed) * (1 - Math.exp(-dt / 0.3));
        t += dt * speed;
        draw();
      }
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
    io.observe(wrap);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
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
  }, [companies]);

  const slow = (on: boolean) => {
    slowRef.current = on;
  };

  return (
    <div className={className} ref={wrapRef}>
      <canvas ref={canvasRef} className="solar-canvas" aria-hidden="true" />
      <ul className="solar-planets" aria-label="Companies">
        {companies.map((c, i) => (
          <li key={c.id}>
            <a
              ref={(el) => {
                planetRefs.current[i] = el;
              }}
              href={companyHref(c)}
              className="planet"
              onMouseEnter={() => slow(true)}
              onMouseLeave={() => slow(false)}
              onFocus={() => slow(true)}
              onBlur={() => slow(false)}
            >
              <span className="planet-disc">
                {c.logo ? (
                  <img src={c.logo} alt="" />
                ) : (
                  <span className="planet-mono" aria-hidden="true">
                    {c.name.slice(0, 1)}
                  </span>
                )}
              </span>
              <span className="planet-label">
                <span className="planet-name">{c.name}</span>
                <span className="planet-meta">{c.ownership}% owned</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
