"use client";

import { useEffect } from "react";
import { highlight } from "./overlay";

/** Briefly marks the card named in the URL hash, on load and whenever the hash changes. */
export function HashHighlight() {
  useEffect(() => {
    const mark = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id) highlight(id);
    };
    mark();
    window.addEventListener("hashchange", mark);
    return () => window.removeEventListener("hashchange", mark);
  }, []);
  return null;
}
