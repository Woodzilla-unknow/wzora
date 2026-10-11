"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

const STORAGE_KEY = "wzora-theme";
const MODES: Mode[] = ["system", "light", "dark"];
const LABELS: Record<Mode, string> = { system: "Auto", light: "Light", dark: "Dark" };

function readMode(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "system";
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    if (mode === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

/** Runs before first paint so a saved light/dark override never flashes. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    setMode(readMode());
  }, []);

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          className={mode === m ? "is-active" : undefined}
          onClick={() => {
            setMode(m);
            applyMode(m);
          }}
          title={m === "system" ? "Follow system theme" : `${LABELS[m]} theme`}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
