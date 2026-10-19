# WZORA

Official information website for WZORA, built with Next.js.

- **Front page:** one scroll-driven scene per section. A wireframe 4D shape turns
  continuously behind WZORA; each scroll step moves to the next section
  ("WZORA.about", "WZORA.mission", …) and morphs the shape.
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

Add an entry to `companies`. It gets its own page, a card under Our Companies, a node
in the site map and a search result:

```ts
{
  id: "kairowz",          // page address: /companies/kairowz
  name: "Kairowz",
  website: "kairowz.com",
  ownership: 100,         // percent owned by WZORA
  body: null,             // or a list of paragraphs
},
```

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```
