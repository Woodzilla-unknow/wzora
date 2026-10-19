# WZORA

Official information website for WZORA, built with Next.js.

- **Front page:** first, WZORA's solar system: the W/Z mark spins in 3D at the centre
  and the companies orbit it, joined to it by lines; the closer the ring, the closer
  the company is to WZORA. Each scroll step then moves to the next section
  ("WZORA.about", "WZORA.mission", …), where a wireframe 4D shape turns inside a frame
  and the spinning mark shrinks into the top-right corner (scrolling back, or clicking
  it, grows it back into the sun).
- **Section pages:** every section has its own page at `/<id>` (`/about`, `/legal`, …).
- **Company pages:** every company WZORA owns has its own page at `/companies/<id>`
  (for example `/companies/kairowz`).
- **Header:** search (⌘K / Ctrl+K or `/`), a site map, and an Auto / Light / Dark switch.
- Black & white only. The theme follows the visitor's system setting unless they pick one.
- The W/Z logo is drawn as SVG in `src/components/Logo.tsx`, so it is crisp at any size
  and changes colour with the theme.

## Editing content

All text lives in `src/content/site.ts`. Search and the site map read from it, so new
content shows up there automatically.

Every section starts with `body: null`, which shows the notice
**"Information is not complete yet."** To publish real content, replace `null` with a
list of paragraphs:

```ts
body: [
  "First paragraph.",
  "Second paragraph.",
],
```

### Adding a company

Add an entry to `companies`. It gets its own page, a card under Our Companies, a planet
in the front page's solar system (its ring set by `orbit`), a node in the site map
and a search result. The site never shows how much of a company WZORA owns:

```ts
{
  id: "kairowz",          // page address: /companies/kairowz
  name: "Kairowz",
  website: "kairowz.com",
  orbit: 1,               // ring in the solar system: 1 = closest, 3 = furthest out
  logo: "/logos/kairowz.svg", // optional: a file in /public; without it, "K" is shown
  body: null,             // or a list of paragraphs
},
```

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```
