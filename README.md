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
css/tokens.css      css/main.css        (all design tokens live in tokens.css)
js/main.js          js/hero-scene.js    (main = one rAF loop; hero-scene = WebGL)
js/preview-machine.js  js/quote-form.js (CTA overlays — lazy, load on first click)
js/site-config.js                       (CONTACT_EMAIL — one place to change it)
assets/vendor/      assets/fonts/       assets/img/favicon.svg
content/            (specs + copy.md — source of truth, not shipped code)
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
- **Preview Machine** ("See My Free Preview" / "Get Started"): an a11y-correct
  dialog (`role="dialog"`, focus trap, Esc/backdrop/X close, focus restore,
  scroll lock) where a miniature themed homepage assembles for the visitor's
  business. `js/preview-machine.js` is dynamically imported on first click —
  zero bytes in the initial load; the triggers' `href`s remain the no-JS
  fallback. User input is rendered via `textContent` only and never leaves the
  page except in the visitor's own mailto handoff.
- **Quote Form** ("Request a Quote" / "Get a Quote"): the same dialog contract,
  lazily imported from `js/quote-form.js` on first click. A short intake —
  the visitor's email is the only required field — that **submits directly
  from the page via [Web3Forms](https://web3forms.com)** (JSON POST, 10 s
  abortable timeout, honeypot spam trap, in-flight/sent states). On failure
  the form stays intact and offers a "Send it by email" mailto fallback
  (compiled body + a `Reply to:` line). The Web3Forms `access_key` lives in
  `js/site-config.js` (`WEB3FORMS_KEY`) — such keys are **public-by-design**
  for client-side embeds, so committing it is correct. Note the Web3Forms
  free tier has a monthly submission cap (~250/mo) — upgrade or swap
  services if lead volume approaches it.
- **Contact email** is centralized in `js/site-config.js` (`CONTACT_EMAIL`) —
  currently the founder's live Gmail. The two static no-JS fallback `href`s in
  `index.html` (finale primary CTA, pricing quote button) must be kept in sync
  by hand when it changes.
- Fonts preloaded; scripts deferred/module; heights reserved to avoid layout shift.
- Hosting note: serve `assets/vendor/*.js` with gzip/brotli and long-lived
  `Cache-Control` (any mainstream static host does this automatically) — three.js
  is ~654 KB raw but ~162 KB gzipped.

## Placeholders to swap before launch

These are intentionally left as obvious placeholders:

| Placeholder | Where | Notes |
|---|---|---|
| `[INSTAGRAM] [X] [LINKEDIN] [EMAIL]` | Footer | Social placeholder chips → real profile links. |
| Contact email | `js/site-config.js` (`CONTACT_EMAIL`) + the two no-JS fallback `href`s in `index.html` | **Live Gmail** (`cresscit@gmail.com`) — real leads arrive there today; swap to a custom-domain inbox later. One edit in `site-config.js` covers both overlays. |
| `WEB3FORMS_KEY` | `js/site-config.js` | Currently `'PENDING_KEY_FROM_FOUNDER'` — the quote form's direct submit will fail (and offer the mailto fallback) until the real Web3Forms access key is pasted in. Public-by-design, safe to commit. |
| **og:image** | `<head>` | **Not yet added.** Add an Open Graph image and a `<meta property="og:image">` tag before sharing on social. |

(The former `[SETUP FEE]` / `[MONTHLY PRICE]` chips were removed when the
pricing section switched to the quote-request flow.)

## Credits

Founded by inder. © 2026 Cresscit.
