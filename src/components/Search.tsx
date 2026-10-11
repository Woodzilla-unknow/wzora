"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { hrefFor, PLACEHOLDER, type Section } from "@/content/site";
import { useOverlay } from "./overlay";

/*
 * Site search as a command palette: a full-screen panel opened from the
 * header button, ⌘K / Ctrl+K, or "/". It searches every section and card in
 * src/content/site.ts, so new content becomes searchable as soon as it is
 * added there. Each result is a link to that section's page (or the card on
 * it); Enter follows the highlighted one.
 */

type Entry = {
  href: string;
  index: string;
  path: string; // "Mission & Vision" or "Mission & Vision / Values"
  title: string;
  label: string;
  body: string[] | null;
};

function buildIndex(sections: Section[]): Entry[] {
  return sections.flatMap((s) => [
    { href: hrefFor(s), index: s.index, path: s.title, title: s.title, label: s.label, body: s.body },
    ...(s.items ?? []).map((item) => ({
      href: hrefFor(s, item),
      index: s.index,
      path: `${s.title} / ${item.title}`,
      title: item.title,
      label: s.label,
      body: item.body,
    })),
  ]);
}

const tokenize = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Every word of the query must appear somewhere; titles count most. */
function score(entry: Entry, words: string[]): number {
  const title = entry.title.toLowerCase();
  const label = entry.label.toLowerCase();
  const body = (entry.body ?? []).join(" ").toLowerCase();
  let total = 0;
  for (const w of words) {
    let s = 0;
    if (title.includes(w)) s = new RegExp(`\\b${escapeRe(w)}`).test(title) ? 4 : 3;
    else if (label.includes(w)) s = 2;
    else if (body.includes(w)) s = 1;
    if (!s) return 0;
    total += s;
  }
  return total;
}

/** An id-safe version of a link, for aria-activedescendant. */
const i2id = (href: string) => href.replace(/[^a-z0-9-]/gi, "-");

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.map(escapeRe).join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/** The paragraph that matches the query, trimmed around the first match. */
function snippet(body: string[] | null, words: string[]): string {
  if (!body?.length) return PLACEHOLDER;
  const para = body.find((p) => words.some((w) => p.toLowerCase().includes(w))) ?? body[0];
  const at = words.length ? Math.max(0, para.toLowerCase().indexOf(words[0]) - 40) : 0;
  const cut = para.slice(at, at + 140);
  return `${at > 0 ? "…" : ""}${cut}${at + 140 < para.length ? "…" : ""}`;
}

export function Search({ sections }: { sections: Section[] }) {
  const index = useMemo(() => buildIndex(sections), [sections]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [shortcut, setShortcut] = useState("Ctrl K");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const words = tokenize(query);
  const results = words.length
    ? index
        .map((e) => ({ e, s: score(e, words) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((r) => r.e)
    : index;

  const close = useCallback(() => setOpen(false), []);

  // Results are real links, so Enter just follows the highlighted one.
  const follow = () => listRef.current?.querySelector<HTMLAnchorElement>('[aria-selected="true"] a')?.click();

  // ⌘K / Ctrl+K anywhere, or "/" when not already typing.
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘K");
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useOverlay(open, close, triggerRef, panelRef);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, query]);

  const onInputKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      follow();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="search-trigger"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.75" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <span className="search-trigger-label">Search WZORA</span>
        <kbd>{shortcut}</kbd>
      </button>

      {open && (
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search WZORA"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div className="search-panel" ref={panelRef}>
            <div className="search-field">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.75" />
                <path d="M10.5 10.5 14 14" />
              </svg>
              <input
                ref={inputRef}
                id="site-search"
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls="search-results"
                aria-activedescendant={results[active] ? `result-${i2id(results[active].href)}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search WZORA"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
              />
              <button type="button" className="search-close" onClick={close}>
                Esc
              </button>
            </div>

            <p className="search-count" aria-live="polite">
              {words.length
                ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                : `${index.length} entries · ${sections.length} sections`}
            </p>

            {results.length ? (
              <ul id="search-results" role="listbox" className="search-results" ref={listRef}>
                {results.map((r, i) => (
                  <li
                    key={r.href}
                    id={`result-${i2id(r.href)}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                  >
                    <a href={r.href} tabIndex={-1} onClick={close}>
                    <span className="search-index">{r.index}</span>
                    <span className="search-text">
                      <span className="search-path">
                        <Highlight text={r.path} words={words} />
                      </span>
                      <span className={`search-snippet${r.body ? "" : " is-empty"}`}>
                        <Highlight text={snippet(r.body, words)} words={r.body ? words : []} />
                      </span>
                    </span>
                    <span className="search-go" aria-hidden="true">
                      ↵
                    </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="search-empty">
                Nothing matches “{query.trim()}”. Try a section name such as About, Contact or Legal.
              </p>
            )}

            <p className="search-keys" aria-hidden="true">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> move
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
