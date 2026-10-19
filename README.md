# WZORA

Official information website for WZORA, built with Next.js.

- **Front page:** a wireframe 4D shape fills the screen behind WZORA. Each scroll step
  moves to the next section ("WZORA.about", "WZORA.mission", …), where the shape turns
  inside a frame. A small W/Z mark spins in 3D in the top-right corner; on
  "WZORA.companies" it grows into the sun of WZORA's solar system, with the companies
  orbiting it, joined to it by lines (the closer the ring, the closer the company is to
  WZORA).
- **Loading screen:** opening or refreshing the site shows the W/Z mark with a loading
  bar under it until the page is ready (moving between pages skips it).
- **Start-up:** a first-time visitor then sees the bar collapse into a dot that builds a
  4D shape one dimension at a time (point, line, square, cube, tesseract), which grows
  into the front page's shape as the site assembles itself piece by piece. It plays
  once per browser; clicking the W/Z logo in the header three times plays it again.
  Both live in `src/components/Boot.tsx`.
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
in the solar system on "WZORA.companies" (its ring set by `orbit`), a node in the site map
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
