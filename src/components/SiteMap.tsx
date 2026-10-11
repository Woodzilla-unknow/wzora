"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hrefFor, site, type Section } from "@/content/site";
import { useOverlay } from "./overlay";

/*
 * The site's navigation, drawn as a map: WZORA at the centre, a straight line
 * out to each section, and from each section a line to each of its pages.
 * Every node is a link and shows whether its information is in yet; hovering
 * a section highlights its lines. When there is not enough room for the
 * pages' labels (narrow or short screens) it shows sections only (their pages
 * are listed on each section's own page), spread to use the space: taller on
 * narrow screens, with labels above or below their dots, wider on short ones.
 */

type Node = {
  key: string;
  href: string;
  x: number;
  y: number;
  index?: string;
  label: string;
  kind: "centre" | "section" | "page";
  section: string;
  done: boolean;
  align: "left" | "right" | "top" | "bottom";
};

type Line = { d: string; section: string; kind: "section" | "page" };
type Graph = { lines: Line[]; nodes: Node[] };

function alignFor(angle: number, narrow: boolean): Node["align"] {
  if (narrow) {
    // Labels sit above or below their dots, except the upper-side and bottom
    // pairs, which would collide with their neighbours; those go out to the sides.
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    if ((Math.abs(c) > 0.6 && sn < 0) || (sn > 0.6 && Math.abs(c) > 0.2)) return c > 0 ? "right" : "left";
    return sn < -0.2 ? "top" : "bottom";
  }
  const c = Math.cos(angle);
  if (c > 0.35) return "right";
  if (c < -0.35) return "left";
  return Math.sin(angle) < 0 ? "top" : "bottom";
}

function buildGraph(sections: Section[], w: number, h: number): Graph {
  const narrow = w < 640;
  // Pages only get their own nodes when the map is big enough for their labels.
  const full = !narrow && Math.min(w / 2 - 160, h / 2 - 36) >= 230;
  const cx = w / 2;
  const cy = h / 2;
  // Radii across and down; a circle on wide screens, taller on narrow ones.
  let rx: number;
  let ry: number;
  if (narrow) {
    rx = Math.max(70, w / 2 - 62);
    ry = Math.max(70, Math.min(h / 2 - 44, rx * 2));
  } else if (full) {
    rx = ry = Math.min(w / 2 - 160, h / 2 - 36);
  } else {
    ry = Math.max(70, h / 2 - 36);
    rx = Math.max(70, Math.min(w / 2 - 150, ry * 1.5));
  }
  const n = sections.length;
  const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  /** Point at `angle`, a fraction `f` of the way out to the map's edge. */
  const at = (angle: number, f: number) => [cx + Math.cos(angle) * f * rx, cy + Math.sin(angle) * f * ry];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;

  const nodes: Node[] = [
    { key: "centre", href: "/", x: cx, y: cy, label: site.name, kind: "centre", section: "", done: true, align: narrow ? "top" : "bottom" },
  ];
  const lines: Line[] = [];
  sections.forEach((s, i) => {
    const angle = angleOf(i);
    const [sx, sy] = at(angle, full ? 0.47 : 0.7);
    lines.push({ d: line(cx, cy, sx, sy), section: s.id, kind: "section" });
    const done = Boolean(s.body) || Boolean(s.items?.some((it) => it.body));
    nodes.push({ key: s.id, href: hrefFor(s), x: sx, y: sy, index: s.index, label: s.label, kind: "section", section: s.id, done, align: alignFor(angle, narrow) });
    if (!full || !s.items) return;
    const sector = (2 * Math.PI) / n;
    const step = (sector * 0.8) / s.items.length;
    s.items.forEach((item, j) => {
      const a = angle + (j - (s.items!.length - 1) / 2) * step;
      const [px, py] = at(a, 0.92);
      lines.push({ d: line(sx, sy, px, py), section: s.id, kind: "page" });
      nodes.push({ key: `${s.id}/${item.title}`, href: hrefFor(s, item), x: px, y: py, label: item.title, kind: "page", section: s.id, done: Boolean(item.body), align: alignFor(a, false) });
    });
  });

  return { lines, nodes };
}

export function SiteMap({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLElement>(null);
  const focused = useRef(false);
  const close = useCallback(() => setOpen(false), []);
  useOverlay(open, close, triggerRef, panelRef);

  // Measure the map's box while open.
  useEffect(() => {
    if (!open) {
      setSize(null);
      setHot(null);
      focused.current = false;
      return;
    }
    const el = graphRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Focus the centre node once, when the map first appears.
  useEffect(() => {
    if (!size || focused.current) return;
    focused.current = true;
    graphRef.current?.querySelector<HTMLElement>(".map-node")?.focus();
  }, [size]);

  const graph = useMemo(() => (size ? buildGraph(sections, size.w, size.h) : null), [sections, size]);
  const pages = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="search-trigger map-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="2" />
          <circle cx="2.8" cy="3.2" r="1.3" />
          <circle cx="13.2" cy="3.2" r="1.3" />
          <circle cx="8" cy="14" r="1.3" />
          <path d="M6.5 6.6 3.8 4.1M9.5 6.6l2.7-2.5M8 10v2.7" />
        </svg>
        <span className="search-trigger-label">Site map</span>
      </button>

      {open && (
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Site map"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div className="search-panel map-panel" ref={panelRef}>
            <div className="map-head">
              <h2>Site map</h2>
              <span className="search-count">
                {sections.length} sections · {pages} pages
              </span>
              <button type="button" className="search-close" onClick={close}>
                Esc
              </button>
            </div>

            <nav className={`map-graph${hot ? " has-hot" : ""}`} ref={graphRef} aria-label="Site map">
              {graph && (
                <>
                  <svg width={size!.w} height={size!.h} aria-hidden="true">
                    {graph.lines.map((l, i) => (
                      <path
                        key={i}
                        d={l.d}
                        pathLength={1}
                        className={`map-line is-${l.kind}${l.section === hot ? " is-hot" : ""}`}
                        style={{ animationDelay: `${(l.kind === "page" ? 0.35 : 0) + i * 0.02}s` }}
                      />
                    ))}
                  </svg>
                  {graph.nodes.map((node, i) => (
                    <a
                      key={node.key}
                      href={node.href}
                      className={`map-node is-${node.kind}${node.section && node.section === hot ? " is-hot" : ""}`}
                      data-align={node.align}
                      style={{ left: node.x, top: node.y, animationDelay: `${0.3 + i * 0.03}s` }}
                      title={node.kind === "centre" ? "Home" : node.done ? "Information published" : "Information is not complete yet"}
                      onClick={close}
                      onMouseEnter={() => setHot(node.section || null)}
                      onMouseLeave={() => setHot(null)}
                      onFocus={() => setHot(node.section || null)}
                      onBlur={() => setHot(null)}
                    >
                      <span className={`map-dot${node.done ? " is-done" : ""}`} />
                      <span className="map-label">
                        {node.index && <span className="map-index">{node.index}</span>}
                        {node.label}
                      </span>
                    </a>
                  ))}
                </>
              )}
            </nav>

            <p className="map-legend">
              <span>
                <span className="map-status is-done" /> Published
              </span>
              <span>
                <span className="map-status" /> Not complete yet
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
