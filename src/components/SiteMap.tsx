"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { anchorFor, type Section } from "@/content/site";
import { goTo, useOverlay } from "./overlay";

/*
 * The site's navigation: a header button that opens a map of every section
 * and the pages inside it. Each entry shows whether its information is in yet.
 */

export function SiteMap({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOverlay(open, close, triggerRef, panelRef);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [open]);

  const jump = (anchor: string) => (e: MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    // Wait for the page to unlock scrolling before moving it.
    requestAnimationFrame(() => goTo(anchor));
  };

  const pages = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
  const status = (body: string[] | null) => (
    <span
      className={`map-status${body ? " is-done" : ""}`}
      title={body ? "Information published" : "Information is not complete yet"}
    />
  );

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
          <path d="M2.5 3.5h4M2.5 8h4M2.5 12.5h4M9.5 3.5h4M9.5 8h4" />
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

            <nav className="map-grid" aria-label="Site map">
              <div className="map-section">
                <a href="#top" className="map-link" onClick={jump("top")}>
                  <span className="map-index">00</span>
                  <span className="map-title">Home</span>
                </a>
              </div>
              {sections.map((s) => (
                <div key={s.id} className="map-section">
                  <a href={`#${s.id}`} className="map-link" onClick={jump(anchorFor(s))}>
                    <span className="map-index">{s.index}</span>
                    <span className="map-title">{s.title}</span>
                    {!s.items && status(s.body)}
                  </a>
                  {s.items && (
                    <ul className="map-pages">
                      {s.items.map((item) => (
                        <li key={item.title}>
                          <a href={`#${anchorFor(s, item)}`} onClick={jump(anchorFor(s, item))}>
                            {item.title}
                            {status(item.body)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </nav>

            <p className="map-legend">
              <span>
                <span className="map-status is-done" /> Information published
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
