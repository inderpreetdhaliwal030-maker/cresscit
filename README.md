# Cresscit — Flagship Landing Page

The agency's own cinematic landing page: a static, no-bundler site. Huge condensed
kinetic type, a WebGL obsidian monolith whose face shows a live mini-website UI and
rotates exactly one full orbit as you scroll the pinned hero, floating holographic
windows in the pillars section, and glowing gallery cards.

## Stack

- **Vanilla HTML / CSS / JS only.** No framework, no bundler, no build step.
- **Vendored dependencies** (in `assets/vendor/`, no runtime CDN requests):
  - `three.module.min.js` — Three.js 0.160, loaded as an ES module via an import map.
  - `lenis.min.js` — Lenis 1.1.14 smooth-scroll (UMD), loaded with `defer`.
- **Self-hosted fonts** (OFL) in `assets/fonts/`: Bebas Neue 400, Inter 400/600.
- All asset paths are **relative** (`./…`) so the site works under a subpath
  (e.g. a GitHub Pages project URL).

## Run locally

No build step. Serve the repo root with any static server, for example:

```sh
# Python 3
python -m http.server 8080

# or Node (if available)
npx serve .
```

Then open <http://localhost:8080>. Opening `index.html` via `file://` will **not**
work — ES modules and the import map require an `http(s)` origin.

## File structure

```
index.html          404.html
css/tokens.css      css/main.css       (all design tokens live in tokens.css)
js/main.js          js/hero-scene.js   (main = one rAF loop; hero-scene = WebGL)
assets/vendor/      assets/fonts/       assets/img/favicon.svg
content/            (BUILD_SPEC.md + copy.md — source of truth, not shipped code)
```

Reusable blocks are marked with `<!-- @component: name -->` comments to seed a
component library.

## Accessibility & performance

- Semantic landmarks, exactly one `<h1>` (CRESSCIT, real text = the LCP element).
- Skip link, visible `:focus-visible` outlines, logical tab order.
- Decorative layers (canvas, grain, forge windows) are `aria-hidden`.
- **Three.js is lazy-loaded off the critical path**: `js/main.js` dynamically
  imports `js/hero-scene.js` only on the first user interaction (pointermove,
  pointerdown, touchstart, keydown, wheel, or scroll — whichever fires first),
  with a ~6 s-after-load fallback timer for completely passive viewers. Until
  the scene initializes, a static CSS poster slab holds the hero (absolutely
  positioned — zero layout shift); the canvas then crossfades in (~400 ms).
  Kinetic type works before the scene loads.
- `prefers-reduced-motion: reduce` disables Lenis and all kinetic effects, renders
  stats at final values, and keeps the static CSS poster monolith — WebGL (and
  three.js itself) is never downloaded in this mode.
- No WebGL (or scene load failure) → the same CSS poster stays; layout never breaks.
- Fonts preloaded; scripts deferred/module; heights reserved to avoid layout shift.
- Hosting note: serve `assets/vendor/*.js` with gzip/brotli and long-lived
  `Cache-Control` (any mainstream static host does this automatically) — three.js
  is ~654 KB raw but ~162 KB gzipped.

## Placeholders to swap before launch

These are intentionally left as obvious placeholders:

| Placeholder | Where | Notes |
|---|---|---|
| `[SETUP FEE]` | Pricing teaser | Rendered as an emerald-outline chip. Swap for real price. |
| `[MONTHLY PRICE]` | Pricing teaser | Same — one-swap literal. |
| `[INSTAGRAM] [X] [LINKEDIN] [EMAIL]` | Footer | Social placeholder chips → real profile links. |
| `mailto:hello@cresscit.com` | Finale primary CTA | Placeholder address for the "See My Free Preview" button. |
| **og:image** | `<head>` | **Not yet added.** Add an Open Graph image and a `<meta property="og:image">` tag before sharing on social. |

## Credits

Founded by inder. © 2026 Cresscit.
