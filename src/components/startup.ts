/*
 * The first-visit start-up's 4D build, shared between the start-up screen
 * (Boot), which sets it going, and the 4D shape that builds itself in step:
 * the front page's own shape, or the start-up screen's on other pages.
 *
 * A tesseract is built one dimension at a time. It starts as a single point;
 * then each axis in turn (x, y, z, w) opens up: every corner built so far
 * splits into two that slide apart along the new axis, drawing the edge
 * between them, one edge after another. Point, line, square, cube, tesseract.
 */

export const POINT = 0.5; // seconds of the lone point
export const AXIS = 1; // seconds for each new dimension
export const GROW = 0.55; // seconds for one new edge to draw itself
/** Seconds from the point appearing to the tesseract being complete. */
export const SHAPE_BUILT = POINT + 4 * AXIS;

let buildStart = 0; // performance.now() when the point appears; 0 = no build running

export function startShapeBuild(at: number) {
  buildStart = at;
}

export function endShapeBuild() {
  buildStart = 0;
}

/** Seconds into the build (negative before the point appears), or null when none is running. */
export function shapeBuildTime(now: number): number | null {
  return buildStart ? (now - buildStart) / 1000 : null;
}

/** How many axes have begun to open at time `s` (0–4). */
export function openAxes(s: number): number {
  return Math.max(0, Math.min(4, Math.floor((s - POINT) / AXIS) + 1));
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** How far (0–1) the jth new edge along axis `k` has grown at time `s`. */
export function edgeGrowth(s: number, k: number, j: number): number {
  const count = 1 << k;
  const gap = count > 1 ? (AXIS - GROW) / (count - 1) : 0;
  return ease((s - POINT - k * AXIS - j * gap) / GROW);
}
