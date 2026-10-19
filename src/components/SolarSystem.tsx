"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { companyHref, type Company } from "@/content/site";

/*
 * The front page's solar system: WZORA's companies orbit a sun (the spinning
 * W/Z mark, drawn separately by Logo3D so it can also fly to the corner of
 * the other scenes), each joined to it by a line. Companies on orbit 1 sit
 * closest to the sun, orbit 3 furthest out.
 *
 * The rings are dots on a tilted plane, so planets come nearer (and grow) as
 * they swing to the front. Two canvases sandwich the sun: the back halves of
 * the rings and lines are drawn behind it, the front halves in front.
 * Planets are real links laid over the canvases; hovering one slows the
 * whole system so it is easy to click.
 */

const ORBITS = [
  { radius: 0.44, speed: 0.3 },
  { radius: 0.7, speed: 0.19 },
  { radius: 0.96, speed: 0.12 },
];

const ELEVATION = 0.38; // how far above the orbital plane we look from (radians)
const PERSPECTIVE = 5; // camera distance, in system radii
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
  /** Told where the sun belongs (centre and width, CSS pixels in the parent's box). */
  onSun?: (x: number, y: number, width: number) => void;
};

export function SolarSystem({ companies, className, active = true, onSun }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const planetRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeRef = useRef(active);
  const slowRef = useRef(false);
  const onSunRef = useRef(onSun);
  activeRef.current = active;
  onSunRef.current = onSun;

  useEffect(() => {
    const wrap = wrapRef.current;
    const back = backRef.current;
    const front = frontRef.current;
    const bctx = back?.getContext("2d");
    const fctx = front?.getContext("2d");
    if (!wrap || !back || !front || !bctx || !fctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Each planet's orbit, and its starting angle spread around that orbit.
    const orbitOf = (c: Company) => Math.min(3, Math.max(1, c.orbit)) - 1;
    const counts = [0, 0, 0];
    const seen = [0, 0, 0];
    companies.forEach((c) => counts[orbitOf(c)]++);
    const planets = companies.map((c) => {
      const o = orbitOf(c);
      const i = seen[o]++;
      return { orbit: o, phase: (i / counts[o]) * Math.PI * 2 + o * 0.9 + 0.5 };
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
      for (const c of [back, front]) {
        c.width = Math.round(wrap.clientWidth * dpr);
        c.height = Math.round(wrap.clientHeight * dpr);
      }
      draw(true);
    };

    const draw = (report = false) => {
      const W = back.width;
      const H = back.height;
      for (const ctx of [bctx, fctx]) ctx.clearRect(0, 0, W, H);
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
      if (report)
        onSunRef.current?.(wrap.offsetLeft + cx / dpr, wrap.offsetTop + cy / dpr, ((narrow ? 0.62 : 0.5) * R) / dpr);

      /** A point on the orbital plane: screen position, depth (+ = nearer) and perspective scale. */
      const at = (angle: number, radius: number) => {
        const x3 = Math.cos(angle) * radius * R;
        const z3 = Math.sin(angle) * radius * R;
        const depth = z3 * cosE;
        const k = (PERSPECTIVE * R) / (PERSPECTIVE * R - depth);
        return { x: cx + x3 * k, y: cy + z3 * sinE * k, depth, k };
      };

      // Rings as dots: the far half behind the sun, the near half in front.
      ORBITS.forEach((o) => {
        const n = Math.max(24, Math.round((2 * Math.PI * o.radius * R) / (DOT_GAP * dpr)));
        for (let i = 0; i < n; i++) {
          const p = at((i / n) * Math.PI * 2, o.radius);
          const ctx = p.depth >= 0 ? fctx : bctx;
          ctx.fillStyle = ink(p.depth >= 0 ? 0.55 : 0.25);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.1 * dpr * p.k, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Lines from the sun to each planet, and the planets themselves.
      planets.forEach((pl, i) => {
        const o = ORBITS[pl.orbit];
        const p = at(pl.phase + t * o.speed, o.radius);
        const ctx = p.depth >= 0 ? fctx : bctx;
        ctx.strokeStyle = ink(p.depth >= 0 ? 0.7 : 0.3);
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        const el = planetRefs.current[i];
        if (!el) return;
        el.style.transform = `translate(${(p.x / dpr).toFixed(1)}px, ${(p.y / dpr).toFixed(1)}px) scale(${p.k.toFixed(3)}) translate(-50%, calc(var(--disc) / -2))`;
        el.style.zIndex = p.depth >= 0 ? "3" : "1";
        el.style.opacity = p.depth >= 0 ? "1" : (0.55 + 0.45 * p.k).toFixed(2);
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
      <canvas ref={backRef} className="solar-canvas is-back" aria-hidden="true" />
      <canvas ref={frontRef} className="solar-canvas is-front" aria-hidden="true" />
      <ul className="solar-planets" aria-label="Companies">
        {companies.map((c, i) => (
          <li key={c.id} style={{ "--i": i } as CSSProperties}>
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
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
