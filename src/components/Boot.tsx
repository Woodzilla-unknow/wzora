"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Polytope4D } from "@/components/Polytope4D";
import { AXIS, POINT, SHAPE_BUILT, endShapeBuild, startShapeBuild } from "@/components/startup";

/*
 * The loading screen, and the start-up a first-time visitor sees.
 *
 * Whenever the site is opened or refreshed, the W/Z mark sits alone in the
 * middle of the screen with a loading bar under it until the page is ready.
 * Moving between pages of the site skips it, so browsing stays quick.
 *
 * On someone's first visit the loading bar then collapses into a single dot,
 * and the 4D shape grows out of that dot one dimension at a time: point,
 * line, square, cube, tesseract (see startup.ts), its faces filling with dots
 * as on the finished shape. On the front page this is the page's own
 * background shape, so the start-up ends in it and it simply carries on;
 * elsewhere the start-up screen builds a shape of its own and lets it go.
 * Then the system creates the page around the shape one piece at a time:
 * the header bar, the logo, search, the site map, the theme switch, the
 * frame, the 3D mark, WZORA, each logged as it comes online.
 *
 * It plays once per browser; three quick clicks on the header logo play it
 * again (see BrandLink).
 *
 * While this screen is up, <html data-boot> holds the page back (see
 * globals.css). It is set before first paint by bootInitScript: "load",
 * "startup", or "off" for page-to-page navigation. Afterwards it reads
 * "done", or "built" once the start-up has created the page. If the site's
 * scripts never arrive, the init script gives up after a few seconds
 * ("fallback") and the page shows as it is.
 */

const STORAGE_KEY = "wzora-started";
const REPLAY_EVENT = "wzora:startup";
// Set when a replay was asked for on a page that is about to be left; the next page plays it.
const REPLAY_KEY = "wzora-replay";

/** Runs before first paint and decides which screen (if any) this load shows. */
export const bootInitScript = `(function(){var d=document.documentElement,m="load",q=matchMedia("(prefers-reduced-motion: reduce)").matches;try{var n=performance.getEntriesByType("navigation")[0],t=n?n.type:"navigate",r=document.referrer,s=false;try{s=!!r&&new URL(r).origin===location.origin}catch(e){}if(t==="back_forward"||(t==="navigate"&&s))m="off";if(!localStorage.getItem("${STORAGE_KEY}")&&!q)m="startup"}catch(e){}try{if(sessionStorage.getItem("${REPLAY_KEY}")){sessionStorage.removeItem("${REPLAY_KEY}");if(!q)m="startup"}}catch(e){}d.setAttribute("data-boot",m);setTimeout(function(){if(!window.__wzoraBoot)d.setAttribute("data-boot","fallback")},8000)})();`;

// The start-up's timeline, in seconds from the moment the loading bar is full.
const COLLAPSE = 0.55; // the bar shrinks into the dot the shape grows from
const HOLD = 0.6; // the finished tesseract turning on its own
const CREATE = COLLAPSE + SHAPE_BUILT + HOLD; // the page starts being created
const STEP = 0.32; // between one piece of the page and the next
const SETTLE = 0.9; // after "online", the log clears and the last details appear
const OUTRO = 0.6; // then the start-up screen goes

const HEADER = 64; // the fixed header's height, kept clear by the front page's shape
const LOG_LINES = 7; // log lines shown at once; older ones scroll away

const MIN_LOAD = 0.7; // the loading bar never fills faster than this
const MAX_LOAD = 6; // or slower: past this, the page is shown regardless

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function readColor(): [number, number, number] {
  const fg = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim();
  return fg === "#000000" || fg === "#000" ? [0, 0, 0] : [255, 255, 255];
}

/** One piece of the page the start-up creates, with its line in the log. */
type Piece = {
  label: string;
  targets: string;
  frames: Keyframe[];
  duration?: number;
  /** Milliseconds between the elements `targets` matches (in their --i order, if they have one). */
  stagger?: number;
};

// How pieces come into being: drawn across, popped up, grown from a corner…
const DRAW: Keyframe[] = [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }];
const WIPE: Keyframe[] = [
  { clipPath: "inset(0 100% 0 0)", filter: "opacity(0)" },
  { clipPath: "inset(0 0% 0 0)", filter: "opacity(1)" },
];
const POP: Keyframe[] = [
  { scale: "0.3", filter: "opacity(0)" },
  { scale: "1", filter: "opacity(1)" },
];
const GROW_IN: Keyframe[] = [
  { scale: "0", filter: "opacity(0)" },
  { scale: "1", filter: "opacity(1)" },
];
const RISE: Keyframe[] = [{ transform: "translateY(105%)" }, { transform: "translateY(0)" }];
const UP: Keyframe[] = [
  { translate: "0 14px", filter: "opacity(0)" },
  { translate: "0 0", filter: "opacity(1)" },
];
const FADE: Keyframe[] = [{ filter: "opacity(0)" }, { filter: "opacity(1)" }];

const HEADER_PIECES: Piece[] = [
  { label: "Header", targets: ".site-header", frames: DRAW, duration: 700 },
  { label: "Logo", targets: ".brand", frames: POP },
  { label: "Search", targets: ".header-center > :nth-child(1)", frames: WIPE },
  { label: "Site map", targets: ".header-center > :nth-child(2)", frames: WIPE },
  { label: "Theme switch", targets: ".theme-toggle", frames: WIPE },
];

const FRONT_PAGE_PIECES: Piece[] = [
  ...HEADER_PIECES,
  { label: "Frame", targets: ".hero-corner", frames: GROW_IN, stagger: 80 },
  { label: "3D mark", targets: ".logo3d", frames: POP, duration: 900 },
  { label: "WZORA", targets: ".hero-word-layer span", frames: RISE, duration: 1000, stagger: 70 },
  { label: "Tagline", targets: ".hero-tagline", frames: WIPE, duration: 700 },
];

const OTHER_PAGE_PIECES: Piece[] = [
  ...HEADER_PIECES,
  { label: "Page", targets: ".page > *", frames: UP, duration: 800, stagger: 100 },
];

// The details that appear once the log has cleared away.
const LAST_DETAILS = ".polytope-name, .scroll-cue > span, .site-footer";

/** Plays the start-up again, here and now. */
export function replayStartup() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

/** Plays the start-up again on the page being loaded next. */
export function replayStartupOnNextPage() {
  try {
    sessionStorage.setItem(REPLAY_KEY, "1");
  } catch {}
}

export function BootScreen() {
  const [run, setRun] = useState(0); // 0 = this page load; 1… = replays
  const [visible, setVisible] = useState(true);
  const [stage, setStage] = useState<"load" | "startup">("load");
  const [ownShape, setOwnShape] = useState(false); // build a shape here (not on the front page)
  const [creating, setCreating] = useState(false); // the page is being created
  const [settled, setSettled] = useState(false); // the log has done its job
  const [leaving, setLeaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [step, setStep] = useState(0); // log lines shown so far
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const replay = () => {
      if (rootRef.current) return; // already showing
      setStage("load");
      setOwnShape(false);
      setCreating(false);
      setSettled(false);
      setLeaving(false);
      setLog([]);
      setStep(0);
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
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    let rgb = readColor();
    let startAt = 0;
    let pieces: Piece[] = [];
    let times: number[] = []; // when each log line appears
    let shownStep = 0;
    let created = false;
    let isSettled = false;
    let barFrom = { x: 0, y: 0, half: 0 };
    let dotTo = { x: 0, y: 0 }; // where the shape grows from: the centre of where it will stand

    // The loading bar shrinks into a dot and moves to where the shape will grow.
    const drawCollapse = (s: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (s >= COLLAPSE) return;
      const [r, g, b] = rgb;
      const u = ease(s / COLLAPSE);
      const x = (barFrom.x + (dotTo.x - barFrom.x) * u) * dpr;
      const y = (barFrom.y + (dotTo.y - barFrom.y) * u) * dpr;
      const half = barFrom.half * (1 - u) * dpr;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x - half, y - dpr, half * 2, 2 * dpr);
      ctx.beginPath();
      // Ends the size of the shape's own point, which takes over from here.
      ctx.arc(x, y, 2.2 * dpr * u, 0, Math.PI * 2);
      ctx.fill();
    };

    // Each piece appears in turn; every element starts hidden until its moment.
    const createPage = () => {
      const animate = (targets: string, frames: Keyframe[], delay: number, duration: number, stagger: number) =>
        document.querySelectorAll<HTMLElement>(targets).forEach((el, j) => {
          if (el.closest(".boot")) return;
          const order = Number(el.style.getPropertyValue("--i") || j);
          el.animate(frames, {
            duration,
            delay: delay + order * stagger,
            easing: "cubic-bezier(0.2, 0.7, 0.1, 1)",
            fill: "backwards",
          });
        });
      pieces.forEach((piece, i) =>
        animate(piece.targets, piece.frames, i * STEP * 1000, piece.duration ?? 600, piece.stagger ?? 0),
      );
      animate(LAST_DETAILS, FADE, (pieces.length * STEP + SETTLE) * 1000, 700, 0);
    };

    const beginStartup = () => {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      const front = document.querySelector<HTMLElement>("[data-scroll-track] .hero-shape");
      if (front) window.scrollTo({ top: 0, behavior: "instant" });
      const br = bar.getBoundingClientRect();
      barFrom = { x: br.left + br.width / 2, y: br.top + br.height / 2, half: br.width / 2 };
      // The front page's shape fills the screen below the header; one of our own fills it all.
      const box = front?.getBoundingClientRect();
      dotTo = box
        ? { x: box.left + box.width / 2, y: box.top + HEADER + (box.height - HEADER) / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      pieces = front ? FRONT_PAGE_PIECES : OTHER_PAGE_PIECES;
      const lines: [string, number][] = [
        ["System start-up", 0],
        ["0D · Point", COLLAPSE],
        ["1D · Line", COLLAPSE + POINT],
        ["2D · Square", COLLAPSE + POINT + AXIS],
        ["3D · Cube", COLLAPSE + POINT + 2 * AXIS],
        ["4D · Tesseract", COLLAPSE + POINT + 3 * AXIS],
        ...pieces.map((piece, i): [string, number] => [piece.label, CREATE + i * STEP]),
        ["WZORA online", CREATE + pieces.length * STEP],
      ];
      times = lines.map(([, at]) => at);
      setLog(lines.map(([line]) => line));
      setOwnShape(!front);

      resize();
      window.addEventListener("resize", resize);
      setStage("startup");
      startAt = performance.now();
      startShapeBuild(startAt + COLLAPSE * 1000);
    };

    const startupFrame = (now: number) => {
      const s = (now - startAt) / 1000;
      let shown = shownStep;
      while (shown < times.length && s >= times[shown]) shown++;
      if (shown !== shownStep) {
        shownStep = shown;
        setStep(shown);
      }
      drawCollapse(s);
      if (!created && s >= CREATE) {
        created = true;
        html.dataset.boot = "built";
        createPage();
        setCreating(true);
      }
      const online = CREATE + pieces.length * STEP;
      if (!isSettled && s >= online + SETTLE) {
        isSettled = true;
        setSettled(true);
      }
      if (s >= online + SETTLE + OUTRO) {
        endShapeBuild();
        leave("built", 0);
      }
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
      endShapeBuild();
      mo.disconnect();
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", resize);
    };
  }, [run, visible]);

  if (!visible) return null;

  const classes = ["boot", creating && "is-creating", settled && "is-settled", leaving && "is-leaving"];
  const first = Math.max(0, step - LOG_LINES);
  return (
    <div className={classes.filter(Boolean).join(" ")} ref={rootRef} data-stage={stage}>
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
      {ownShape && <Polytope4D className="boot-shape" shape="tesseract" build />}
      <canvas className="boot-canvas" ref={canvasRef} aria-hidden="true" />
      <ol className="boot-log" aria-hidden="true">
        {log.slice(first, step).map((line, i) => (
          <li key={line}>
            <span>{line}</span>
            <span className="boot-log-status">{first + i < step - 1 || step === log.length ? "OK" : "··"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
