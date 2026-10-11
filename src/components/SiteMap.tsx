"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hrefFor, site, type Section } from "@/content/site";
import { useOverlay } from "./overlay";

/*
 * The site's navigation, drawn as a spider web. WZORA sits at the centre;
 * each section hangs on its own radial thread, and its pages branch off
 * further out. Every node is a link and shows whether its information is in
 * yet. The web spins itself in when opened and trembles when a node is
 * touched. When there is not enough room for the pages' labels (narrow or
 * short screens) it shows sections only (their pages are listed on each
 * section's own page), stretched to use the space: taller on narrow screens,
 * with labels above or below their dots, wider on short ones.
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

type Web = { spokes: string[]; spokeOwner: (string | null)[]; rings: string[]; branches: { d: string; section: string }[]; nodes: Node[] };

const RINGS = [0.14, 0.27, 0.4, 0.53, 0.66, 0.79, 0.92, 1.04];

/** Small, repeatable irregularity so the web looks spun rather than plotted. */
const jitter = (a: number, b: number) => Math.sin(a * 12.9898 + b * 78.233) * 0.5;

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

function buildWeb(sections: Section[], w: number, h: number): Web {
  const narrow = w < 640;
  // Pages only get their own nodes when the web is big enough for their labels.
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
  const perSection = 3;
  const N = n * perSection;
  const angleOf = (k: number) => -Math.PI / 2 + (k * 2 * Math.PI) / N;
  /** Point at `angle`, a fraction `f` of the way out to the web's edge. */
  const at = (angle: number, f: number) => [cx + Math.cos(angle) * f * rx, cy + Math.sin(angle) * f * ry];

  // Radial threads; every third one carries a section.
  const spokes: string[] = [];
  const spokeOwner: (string | null)[] = [];
  for (let k = 0; k < N; k++) {
    const [x, y] = at(angleOf(k), 1.08);
    spokes.push(`M${cx} ${cy}L${x.toFixed(1)} ${y.toFixed(1)}`);
    spokeOwner.push(k % perSection === 0 ? sections[k / perSection].id : null);
  }

  // Capture threads: rings that sag a little toward the centre between spokes.
  const rings = RINGS.map((f, ri) => {
    const pts = Array.from({ length: N }, (_, k) => at(angleOf(k), f * (1 + jitter(k, ri) * 0.06)));
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let k = 0; k < N; k++) {
      const [x1, y1] = pts[k];
      const [x2, y2] = pts[(k + 1) % N];
      const qx = cx + ((x1 + x2) / 2 - cx) * 0.93;
      const qy = cy + ((y1 + y2) / 2 - cy) * 0.93;
      d += `Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    return d;
  });

  const nodes: Node[] = [
    { key: "centre", href: "/", x: cx, y: cy, label: site.name, kind: "centre", section: "", done: true, align: narrow ? "top" : "bottom" },
  ];
  const branches: Web["branches"] = [];
  sections.forEach((s, i) => {
    const angle = angleOf(i * perSection);
    const [sx, sy] = at(angle, full ? 0.47 : 0.7);
    const done = Boolean(s.body) || Boolean(s.items?.some((it) => it.body));
    nodes.push({ key: s.id, href: hrefFor(s), x: sx, y: sy, index: s.index, label: s.label, kind: "section", section: s.id, done, align: alignFor(angle, narrow) });
    if (!full || !s.items) return;
    const sector = (2 * Math.PI) / n;
    const step = (sector * 0.8) / s.items.length;
    s.items.forEach((item, j) => {
      const a = angle + (j - (s.items!.length - 1) / 2) * step;
      const [px, py] = at(a, 0.92);
      const [qx, qy] = at(angle + (a - angle) * 0.4, 0.74);
      branches.push({ d: `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`, section: s.id });
      nodes.push({ key: `${s.id}/${item.title}`, href: hrefFor(s, item), x: px, y: py, label: item.title, kind: "page", section: s.id, done: Boolean(item.body), align: alignFor(a, false) });
    });
  });

  return { spokes, spokeOwner, rings, branches, nodes };
}

export function SiteMap({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const webRef = useRef<HTMLElement>(null);
  const focused = useRef(false);
  const close = useCallback(() => setOpen(false), []);
  useOverlay(open, close, triggerRef, panelRef);

  // Measure the web's box while open.
  useEffect(() => {
    if (!open) {
      setSize(null);
      setHot(null);
      focused.current = false;
      return;
    }
    const el = webRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Focus the centre node once, when the web first appears.
  useEffect(() => {
    if (!size || focused.current) return;
    focused.current = true;
    webRef.current?.querySelector<HTMLElement>(".web-node")?.focus();
  }, [size]);

  const web = useMemo(() => (size ? buildWeb(sections, size.w, size.h) : null), [sections, size]);
  const pages = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);

  // Touching a node makes the whole web tremble.
  const touch = (section: string | null) => {
    setHot(section);
    const svg = webRef.current?.querySelector("svg");
    if (!svg || !section) return;
    svg.classList.remove("is-trembling");
    void svg.getBoundingClientRect();
    svg.classList.add("is-trembling");
  };

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
          <path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" />
          <path d="M8 4.5 10.5 5.5 11.5 8 10.5 10.5 8 11.5 5.5 10.5 4.5 8 5.5 5.5Z" />
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

            <nav className={`map-web${hot ? " has-hot" : ""}`} ref={webRef} aria-label="Site map">
              {web && (
                <>
                  <svg width={size!.w} height={size!.h} aria-hidden="true">
                    {web.rings.map((d, i) => (
                      <path key={`r${i}`} d={d} pathLength={1} className="web-ring" style={{ animationDelay: `${0.35 + i * 0.07}s` }} />
                    ))}
                    {web.spokes.map((d, i) => (
                      <path
                        key={`s${i}`}
                        d={d}
                        pathLength={1}
                        className={`web-spoke${web.spokeOwner[i] ? " is-section" : ""}${web.spokeOwner[i] && web.spokeOwner[i] === hot ? " is-hot" : ""}`}
                        style={{ animationDelay: `${i * 0.012}s` }}
                      />
                    ))}
                    {web.branches.map((b, i) => (
                      <path key={`b${i}`} d={b.d} pathLength={1} className={`web-branch${b.section === hot ? " is-hot" : ""}`} style={{ animationDelay: `${0.9 + i * 0.03}s` }} />
                    ))}
                  </svg>
                  {web.nodes.map((node, i) => (
                    <a
                      key={node.key}
                      href={node.href}
                      className={`web-node is-${node.kind}${node.section && node.section === hot ? " is-hot" : ""}`}
                      data-align={node.align}
                      style={{ left: node.x, top: node.y, animationDelay: `${0.6 + i * 0.03}s` }}
                      title={node.kind === "centre" ? "Home" : node.done ? "Information published" : "Information is not complete yet"}
                      onClick={close}
                      onMouseEnter={() => touch(node.section || null)}
                      onMouseLeave={() => setHot(null)}
                      onFocus={() => touch(node.section || null)}
                      onBlur={() => setHot(null)}
                    >
                      <span className={`web-dot${node.done ? " is-done" : ""}`} />
                      <span className="web-label">
                        {node.index && <span className="web-index">{node.index}</span>}
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
