# WZORA

Official information website for WZORA — a single scrolling page built with Next.js.

- Black & white only. The theme follows the visitor's system setting automatically,
  with an optional Auto / Light / Dark switch in the header (the choice is remembered).
- The W/Z logo is drawn as SVG in `src/components/Logo.tsx`, so it is crisp at any size
  and changes color with the theme.

## Editing content

All text lives in `src/content/site.ts`. Every section starts with `body: null`, which shows
the notice **"Information is not complete yet."** To publish real content, replace `null`
with a list of paragraphs:

```ts
body: [
  "First paragraph.",
  "Second paragraph.",
],
```

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```
