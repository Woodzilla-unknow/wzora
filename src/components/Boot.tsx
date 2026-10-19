"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";

/*
 * The loading screen, and the start-up a first-time visitor sees.
 *
 * Whenever the site is opened or refreshed, the W/Z mark sits alone in the
 * middle of the screen with a loading bar under it until the page is ready.
 * Moving between pages of the site skips it, so browsing stays quick.
 *
 * On someone's first visit the loading bar then collapses into a single dot,
 * and the dot builds a 4D shape one dimension at a time: the point stretches
 * into a line, the line sweeps out a square, the square a cube and the cube
 * a tesseract, each new edge drawn one after another. The tesseract turns,
 * shrinks into the sun of the front page, and the site assembles around it
 * piece by piece. It plays once per browser; the footer can replay it.
 *
 * While this screen is up, <html data-boot> holds the page's own entrance
 * animations (see globals.css). It is set before first paint by
 * bootInitScript: "load", "startup", or "off" for page-to-page navigation.
 * Afterwards it reads "done", or "built" once the start-up has assembled
 * the page. If the site's scripts never arrive, the init script gives up
 * after a few seconds ("fallback") and the page shows as it is.
 */

const STORAGE_KEY = "wzora-started";
const REPLAY_EVENT = "wzora:startup";

/** Runs before first paint and decides which screen (if any) this load shows. */
export const bootInitScript = `(function(){var d=document.documentElement,m="load";try{var n=performance.getEntriesByType("navigation")[0],t=n?n.type:"navigate",r=document.referrer,s=false;try{s=!!r&&new URL(r).origin===location.origin}catch(e){}if(t==="back_forward"||(t==="navigate"&&s))m="off";if(!localStorage.getItem("${STORAGE_KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)m="startup"}catch(e){}d.setAttribute("data-boot",m);setTimeout(function(){if(!window.__wzoraBoot)d.setAttribute("data-boot","fallback")},8000)})();`;

const LOG = ["System start-up", "0D · Point", "1D · Line", "2D · Square", "3D · Cube", "4D · Tesseract", "WZORA online"];

// The start-up's timeline, in seconds.
const COLLAPSE = 0.55; // the loading bar shrinks into a dot
const POINT = 0.5; // the dot on its own
const AXIS = 1; // each new dimension
const GROW = 0.55; // one new edge drawing itself, within a dimension
const HOLD = 1.1; // the finished tesseract turning
const DOCK = 0.9; // shrinking into place as the page appears
const AXES_START = COLLAPSE + POINT;
const HOLD_START = AXES_START + 4 * AXIS;
const DOCK_START = HOLD_START + HOLD;

const MIN_LOAD = 0.7; // the loading bar never fills faster than this
const MAX_LOAD = 6; // or slower: past this, the page is shown regardless

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function readColor(): [number, number, number] {
  const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim();
  return fg === "#000000" || fg === "#000" ? [0, 0, 0] : [255, 255, 255];
}

/** Lets the footer play the start-up again. */
export function ReplayStartup({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}>
      Replay start-up
    </button>
  );
}

export function BootScreen() {
  const [run, setRun] = useState(0); // 0 = this page load; 1… = replays
  const [visible, setVisible] = useState(true);
  const [stage, setStage] = useState<"load" | "startup">("load");
  const [docking, setDocking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const replay = () => {
      if (rootRef.current) return; // already showing
      setStage("load");
      setStep(0);
      setDocking(false);
      setLeaving(false);
      setVisible(true);
      setRun((r) => r + 1);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const root = rootRef.current;
    const bar = barRef.current;
    const fill = fillRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!visible || !root || !bar || !fill || !canvas || !ctx) return;

    (window as Window & { __wzoraBoot?: boolean }).__wzoraBoot = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (run === 0 && (html.dataset.boot === "off" || html.dataset.boot === "fallback")) {
      setVisible(false);
      return;
    }
    const mode = !reducedMotion && (run > 0 || html.dataset.boot === "startup") ? "startup" : "load";
    html.dataset.boot = mode;
    if (run > 0) window.scrollTo({ top: 0, behavior: "instant" });

    let frame = 0;
    let done = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    // ── Loading bar ──
    // Before this script runs, a CSS animation creeps the bar forward; carry on from there.
    const crept = getComputedStyle(fill).transform;
    let p = crept && crept !== "none" ? new DOMMatrixReadOnly(crept).a : 0;
    fill.classList.add("is-live");
    let fontsReady = !document.fonts;
    let loaded = document.readyState === "complete";
    document.fonts?.ready.then(() => (fontsReady = true));
    const onLoad = () => (loaded = true);
    window.addEventListener("load", onLoad);
    const loadStart = performance.now();
    const minLoad = run > 0 ? 0.5 : MIN_LOAD;

    const leave = (state: "done" | "built", fadeMs: number) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      html.dataset.boot = state;
      setLeaving(true);
      later(() => setVisible(false), fadeMs);
    };

    // ── Start-up ──
    const [vw, vh] = [window.innerWidth, window.innerHeight];
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    let rgb = readColor();
    let startAt = 0;
    let barFrom = { x: vw / 2, y: vh / 2, half: 80 };
    let shownStep = 0;
    let built = false;
    // Where the tesseract finishes: the sun, if the front page is showing it.
    let dockTo = { x: vw / 2, y: vh / 2, size: 0 };

    // A tesseract's 16 corners are the binary numbers 0000–1111: bit k says
    // which side of axis k (x, y, z, w) the corner is on. Its 32 edges join
    // corners that differ in a single bit.
    const corners = Array.from({ length: 16 }, (_, v) => [0, 1, 2, 3].map((k) => ((v >> k) & 1 ? 1 : -1)));

    const drawStartup = (s: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const [r, g, b] = rgb;
      const ink = (a: number) => `rgba(${r},${g},${b},${a.toFixed(3)})`;
      let cx = W / 2;
      let cy = H / 2;
      let alpha = 1;

      // The loading bar, collapsing into a dot as it moves to the centre.
      if (s < COLLAPSE) {
        const u = ease(s / COLLAPSE);
        const x = (barFrom.x + (vw / 2 - barFrom.x) * u) * dpr;
        const y = (barFrom.y + (vh / 2 - barFrom.y) * u) * dpr;
        const half = barFrom.half * (1 - u) * dpr;
        ctx.fillStyle = ink(1);
        ctx.fillRect(x - half, y - 0.5 * dpr, half * 2, dpr);
        ctx.beginPath();
        ctx.arc(x, y, 3 * dpr * u, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      // Each dimension k opens up in turn. Its new edges grow one after
      // another: edge j along axis k joins the jth corner built so far to its copy.
      const opened = (k: number, j: number) => {
        const start = AXES_START + k * AXIS;
        const count = 1 << k;
        const gap = count > 1 ? (AXIS - GROW) / (count - 1) : 0;
        return ease((s - start - j * gap) / GROW);
      };
      const dims = Math.max(0, Math.min(4, Math.floor((s - AXES_START) / AXIS) + 1));
      const count = 1 << dims;

      // Turn it slowly in 3D from the start, and through the 4th dimension once it has one.
      const t = s - AXES_START;
      const a = 0.25 + 0.42 * Math.max(0, t);
      const tilt = 0.12 + 0.38 * ease(t / 3);
      const w4 = Math.max(0, s - (AXES_START + 3 * AXIS));
      const c1 = 0.5 * w4 * ease(w4 / 1.5);
      const c2 = 0.27 * w4 * ease(w4 / 1.5);
      let unit = Math.min(W * 0.16, H * 0.12);

      if (s > DOCK_START) {
        const u = ease((s - DOCK_START) / DOCK);
        cx += (dockTo.x * dpr - cx) * u;
        cy += (dockTo.y * dpr - cy) * u;
        unit += ((dockTo.size * dpr) / 4 - unit) * u;
        alpha = 1 - u;
      }

      const [ca, sa, cb, sb] = [Math.cos(a), Math.sin(a), Math.cos(tilt), Math.sin(tilt)];
      const [c1c, c1s, c2c, c2s] = [Math.cos(c1), Math.sin(c1), Math.cos(c2), Math.sin(c2)];
      const pts = corners.slice(0, count).map((c, v) => {
        // Spread along each opened axis by how far that corner's edge has grown.
        const q = c.map((side, k) => (k < dims ? side * opened(k, v & ((1 << k) - 1)) : 0));
        let [x, y, z, w] = q;
        [x, w] = [x * c1c - w * c1s, x * c1s + w * c1c];
        [y, w] = [y * c2c - w * c2s, y * c2s + w * c2c];
        const k4 = 4 / (4 - w);
        x *= k4;
        y *= k4;
        z *= k4;
        [x, z] = [x * ca + z * sa, -x * sa + z * ca];
        [y, z] = [y * cb - z * sb, y * sb + z * cb];
        const k3 = 6 / (6 - z);
        return { x: cx + x * k3 * unit, y: cy + y * k3 * unit, z };
      });

      ctx.lineWidth = dpr;
      ctx.lineCap = "butt";
      for (let v = 0; v < count; v++) {
        for (let k = 0; k < dims; k++) {
          const u = v ^ (1 << k);
          if (u < v) continue;
          const depth = (pts[v].z + pts[u].z) / 2;
          ctx.strokeStyle = ink(alpha * (0.55 + 0.35 * clamp01(0.5 + depth / 3)));
          ctx.beginPath();
          ctx.moveTo(pts[v].x, pts[v].y);
          ctx.lineTo(pts[u].x, pts[u].y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = ink(alpha);
      const pulse = dims === 0 ? 1 + 0.25 * Math.sin((s - COLLAPSE) * 9) : 1;
      for (const pt of pts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.6 * dpr * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const beginStartup = () => {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      const br = bar.getBoundingClientRect();
      barFrom = { x: br.left + br.width / 2, y: br.top + br.height / 2, half: br.width / 2 };
      resize();
      window.addEventListener("resize", resize);
      setStage("startup");
      startAt = performance.now();
    };

    const startupFrame = (now: number) => {
      const s = (now - startAt) / 1000;
      // The log gains a line as each stage begins.
      const nextStep =
        s < COLLAPSE ? 0 : s < AXES_START ? 1 : s < HOLD_START ? 2 + Math.floor((s - AXES_START) / AXIS) : 6;
      if (nextStep !== shownStep) {
        shownStep = nextStep;
        setStep(nextStep);
      }
      if (!built && s >= DOCK_START) {
        built = true;
        const sun = document.querySelector<HTMLElement>('[data-scene="hero"] > .logo3d');
        const box = sun?.getBoundingClientRect();
        if (box && box.width > 0 && box.bottom > 0 && box.top < vh)
          dockTo = { x: box.left + box.width / 2, y: box.top + box.height / 2, size: box.width };
        html.dataset.boot = "built";
        setDocking(true);
      }
      drawStartup(s);
      if (s >= DOCK_START + DOCK) leave("built", 0);
    };

    const loop = (now: number) => {
      if (startAt === 0) {
        const elapsed = (now - loadStart) / 1000;
        let goal = 0.3 + (fontsReady ? 0.3 : 0) + (loaded ? 0.4 : 0);
        if (elapsed > MAX_LOAD) goal = 1;
        goal = Math.min(goal, 0.2 + elapsed / minLoad);
        p = Math.max(p, p + (goal - p) * 0.16);
        if (goal >= 1 && p > 0.992) p = 1;
        fill.style.transform = `scaleX(${p.toFixed(4)})`;
        bar.setAttribute("aria-valuenow", String(Math.round(p * 100)));
        if (p === 1) {
          if (mode === "load") {
            later(() => leave("done", 500), 120);
            return;
          }
          beginStartup();
        }
      } else {
        startupFrame(now);
        if (done) return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const updateColor = () => (rgb = readColor());
    const mo = new MutationObserver(updateColor);
    mo.observe(html, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      mo.disconnect();
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", resize);
    };
  }, [run, visible]);

  if (!visible) return null;

  return (
    <div
      className={`boot${docking ? " is-docking" : ""}${leaving ? " is-leaving" : ""}`}
      ref={rootRef}
      data-stage={stage}
    >
      <div className="boot-center">
        <Logo className="boot-logo" />
        <div
          className="boot-bar"
          ref={barRef}
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span className="boot-bar-fill" ref={fillRef} />
        </div>
      </div>
      <canvas className="boot-canvas" ref={canvasRef} aria-hidden="true" />
      <ol className="boot-log" aria-hidden="true">
        {LOG.slice(0, stage === "startup" ? step + 1 : 0).map((line, i) => (
          <li key={line}>
            <span>{line}</span>
            <span className="boot-log-status">{i < step || i === LOG.length - 1 ? "OK" : "··"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
