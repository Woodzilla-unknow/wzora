"use client";

import type { MouseEvent, ReactNode } from "react";
import { replayStartup, replayStartupOnNextPage } from "@/components/Boot";

/*
 * The header logo. It leads to the front page (or, on the front page, back
 * to its top), and three quick clicks play the start-up again. The count is
 * kept in sessionStorage so it carries across the page change the first
 * click starts: if the third click lands before the front page has loaded,
 * the front page plays the start-up when it arrives.
 */

const CLICKS_KEY = "wzora-logo-clicks";
const GAP = 600; // most milliseconds between one click and the next

let memory = { n: 0, t: 0 }; // used when sessionStorage is unavailable

function countClick(): number {
  let prev = memory;
  try {
    prev = JSON.parse(sessionStorage.getItem(CLICKS_KEY) ?? "null") ?? prev;
  } catch {}
  const now = Date.now();
  const n = now - prev.t < GAP ? prev.n + 1 : 1;
  // A third click starts the count over.
  memory = { n: n >= 3 ? 0 : n, t: now };
  try {
    sessionStorage.setItem(CLICKS_KEY, JSON.stringify(memory));
  } catch {}
  return n;
}

type Props = { className?: string; label: string; children: ReactNode };

export function BrandLink({ className, label, children }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const clicks = countClick();
    if (document.querySelector("[data-scroll-track]")) {
      // Already on the front page.
      e.preventDefault();
      if (clicks >= 3) replayStartup();
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (clicks >= 3) {
      replayStartupOnNextPage();
    }
  };

  return (
    <a href="/" className={className} aria-label={label} onClick={onClick}>
      {children}
    </a>
  );
}
