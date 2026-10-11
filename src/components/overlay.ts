"use client";

import { useEffect, type RefObject } from "react";

/**
 * Shared behaviour for the full-screen panels (search, site map) while open:
 * the page behind stops scrolling, Esc closes, Tab stays inside the panel, and
 * focus returns to the button that opened it.
 */
export function useOverlay(
  open: boolean,
  close: () => void,
  trigger: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>("a[href], button, input");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    const opener = trigger.current;
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [open, close, trigger, panel]);
}

/** Scroll to a section or card and briefly mark it. */
export function goTo(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  history.replaceState(null, "", anchor === "top" ? location.pathname : `#${anchor}`);
  if (anchor === "top") return;
  el.classList.remove("is-target");
  void el.offsetWidth; // restart the highlight animation
  el.classList.add("is-target");
  window.setTimeout(() => el.classList.remove("is-target"), 2200);
}
