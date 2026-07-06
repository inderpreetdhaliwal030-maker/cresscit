# CRESSCIT Flagship — Build Spec (Art Direction + Engineering)
Authoritative blueprint. Copy comes from `content/copy.md` — use it verbatim, no rewording.

## 0. Stack rules
- Static, no bundler, no framework, no build step. Site must run by serving the repo root.
- Vendored deps only (already in `assets/vendor/`): `three.module.min.js` (0.160), `lenis.min.js` (UMD).
- Three.js loads via import map: `{"imports": {"three": "./assets/vendor/three.module.min.js"}}`; hero scene is an ES module.
- No GSAP, no CDN requests at runtime, no analytics yet, no secrets anywhere.
- All paths RELATIVE (`./…`) — site must work under a subpath (GitHub Pages project URL).

## 1. File structure
```
index.html          404.html
css/tokens.css      css/main.css
js/main.js          js/hero-scene.js
assets/vendor/      assets/fonts/      assets/img/favicon.svg
```
Mark every reusable block with `<!-- @component: name -->` comments (seeds the Phase-1 library).

## 2. Design tokens (css/tokens.css — every color/space/type value lives HERE only)
```
--ink: #0a0a0c;        --ink-2: #101014;      --ink-3: #16161c;
--emerald: #19e08c;    --emerald-deep: #0b9159; --emerald-glow: rgba(25,224,140,.35);
--cream: #f4efe4;      --cream-dim: #b9b4a6;
--font-display: 'Bebas Neue', 'Arial Narrow', sans-serif;  /* huge condensed */
--font-body: 'Inter', system-ui, sans-serif;
```
Plus spacing scale (4/8/16/24/40/64/96/160), radii (6/14/24), z-layers, easings
(`--ease-out: cubic-bezier(.16,1,.3,1)`), durations. Self-host fonts (OFL licensed) — download:
- https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@5/files/bebas-neue-latin-400-normal.woff2
- https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff2
- https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-600-normal.woff2
`font-display: swap`, preload the two above-the-fold faces.

## 3. Global feel
Ink-black page, cream type, emerald only as accent/glow. Film grain: fixed full-page overlay,
inline SVG `feTurbulence` noise tile, ~4% opacity, animated in 8 steps (steps() keyframes),
`pointer-events:none`. Lenis smooth scroll on desktop; on touch, native scroll (Lenis
`syncTouch:false` default). Single rAF loop drives Lenis + hero render + scroll-progress
callbacks — one loop, not several.

**Scroll engine (tiny, hand-rolled):** helper `onProgress(el, fn)` computes 0→1 progress of an
element's scroll range from `getBoundingClientRect` each frame (cheap, ~3 sections) and calls
`fn(p)`. Pinning via CSS `position: sticky` wrappers (outer tall section, inner `height:100vh;
position:sticky; top:0`). Reveals via one shared IntersectionObserver adding `.is-in`.

`prefers-reduced-motion: reduce` → kill Lenis, kinetic effects, count-up animation (values render
final), monolith renders ONE static frame (yaw ~25°) with no scroll binding. Everything readable.

## 4. Sections & choreography (order fixed)

### NAV `@component: nav`
Fixed top. Wordmark "CRESSCIT" (display font, small, tracked wide) · links Work / Pricing /
Contact · emerald "Get Started" pill → same target as primary CTA. Transparent over hero, gains
`backdrop-filter: blur` + ink tint + hairline border once scrolled past 60vh. Skip-link first.

### HERO — THE MONOLITH `@component: hero-monolith` (outer 300vh, pinned inner)
Full-viewport WebGL canvas (`js/hero-scene.js`), `aria-hidden="true"`.
**Scene:** black void, near-black fog. Monolith = portrait slab (BoxGeometry ~2.2 × 3.4 × 0.28),
`MeshPhysicalMaterial` obsidian: color #0b0b0e, metalness .35, roughness .22, clearcoat 1,
clearcoatRoughness .15. **Screen face:** plane floating 0.02 in front of the +Z face with an
emissive `CanvasTexture` — an offscreen 2D canvas drawing a MINI LIVE WEBSITE UI (tiny nav bar,
bold hero block, emerald button, three cards) in the brand palette, with a shimmer sweep and a
blinking cursor; update texture every 3rd frame. **Light:** emerald key/rim (SpotLight behind
left, intensity high, color --emerald), dim cool fill front-right, faint top white. ~180 emerald
dust particles (`Points`, additive, slow drift). Fake bloom via CSS: radial emerald gradient div
behind canvas + soft glow pseudo-element — no EffectComposer.
**Scroll (progress p over 300vh):** monolith `rotation.y = p * 2π` (exactly one orbit),
`rotation.x` sine wobble ±0.05, camera dollies 6.2→5.4. Title "CRESSCIT" overlays the canvas in
display font at ~18vw, one `<span>` per letter: letters track in staggered (translateY + blur→0 +
opacity) across p 0→0.35. Subtitle + scroll hint fade in p 0.05→0.2; subtitle stays. Scroll hint
(thin line + "Scroll") pulses, fades out after p 0.5.
**Budgets/fallbacks:** DPR clamp `min(dpr, 1.75)` (1.25 if `pointer:coarse`), pause render when
hero offscreen (IntersectionObserver), `powerPreference:'high-performance'`, context-lost handler.
No WebGL → CSS fallback: a 2D "monolith" (skewed gradient rect + emerald edge) so layout never
breaks. H1 = the title text (real text, not canvas) — it is the LCP element.

### STATS STRIP `@component: stats`
Four stats on a hairline-ruled band. Value in display font ~7rem, suffix small, label
cream-dim. Count-up ONCE when ≥50% visible: 900ms, easeOut, integers except 99.9 (1 decimal).
Numbers use `font-variant-numeric: tabular-nums` — zero layout shift.

### PILLARS — THE FORGE `@component: pillars-forge` (outer 300vh, pinned inner)
Background: `perspective: 1000px` void with 5 floating holographic browser windows (DOM divs):
translucent ink panels, 1px emerald borders at ~35% alpha, mini traffic-light dots, skeleton
bars that shimmer in sequentially (sites "assembling themselves"). Each at different
translateZ/scale/blur (depth), slow idle drift keyframes + scroll parallax (translateY by p,
different factors). Foreground: 3 pillars from copy.md, each owning a third of p: giant ghosted
"01/02/03" numeral, headline in display font, body ≤ 34ch. Inactive pillars dim to 25% + slight
translateY; active is full cream. Crossfade at thirds, no dead zones.

### WORK — THE DELIVERY `@component: work-cards`
Section header ("Work", display font, big) then 3 cards (grid desktop / stack mobile), one per
copy.md concept. Card = glowing screen in a dark gallery: ink-2 panel, radius 24, inner "screen"
area with a PURE-CSS mini site mockup per vertical (restaurant: menu rows + hero band; contractor:
photo-grid blocks + quote button; clinic: calm rows + booking pill) built from divs — no images.
Business name + one-liner below; "Concept" tag = small emerald-outline pill next to the name.
Hover (fine pointers only): tilt toward cursor (max 6°), scale 1.02, emerald edge glow
(box-shadow --emerald-glow), mockup brightens. Entrance: staggered rise+fade via observer.
Keyboard: cards are focusable only if they link somewhere; otherwise not in tab order.

### HOW IT WORKS `@component: steps`
Three numbered steps from copy.md on one rail: emerald numeral, bold name, one line. Reveal
staggered on scroll. Compact — a breath between the big set pieces.

### PRICING TEASER `@component: pricing` (id="pricing")
Full-width band, ink-2. Both copy.md lines; `[SETUP FEE]` and `[MONTHLY PRICE]` rendered
literally inside `<mark class="ph">` (emerald-outline chips, monospace) — obvious placeholders,
one-swap later.

### FINALE CTA `@component: cta-finale` (id="contact")
Tall (~160vh feel) closing: "GET YOUR SITE LIVE THIS WEEK." in display font ~9vw, revealed
word-by-word on scroll (translateY+opacity stagger). Primary button: emerald fill, ink text,
"See My Free Preview" → `mailto:hello@cresscit.com?subject=Free%20preview%20request` (documented
placeholder). Secondary: cream outline, "See Pricing" → `#pricing`. Microline below in cream-dim.
Buttons: 200ms ease-out hover (primary glow-lifts, secondary fills cream/ink), visible
`:focus-visible` emerald outline.

### FOOTER `@component: footer`
Hairline top border. Tagline · social placeholders `[INSTAGRAM] [X] [LINKEDIN] [EMAIL]` as
`.ph` chips · "Founded by inder." · "© 2026 Cresscit". Quiet, small, cream-dim.

### 404.html
Minimal: nav wordmark, 404 line from copy.md, emerald "Go home" button. Same tokens.

## 5. Head / SEO / a11y / perf — hard requirements
- SEO META section of copy.md verbatim: title, description, OG title/desc + `og:type=website`,
  `theme-color` = --ink. Favicon: `assets/img/favicon.svg` — emerald "C" monogram on ink
  rounded square (hand-author the SVG). No og:image yet (note it in README).
- Semantic landmarks (`header/main/section/footer`), exactly one `h1` (CRESSCIT), sections
  labelled by headings; decorative layers `aria-hidden`.
- Contrast: body text cream on ink; emerald never used for body text below 24px.
- Keyboard: skip link, logical tab order, all interactive elements reachable, focus-visible.
- Perf: JS deferred/module; three.js loads only from hero module; fonts preloaded; zero CLS
  (reserve all heights); no console errors/warnings; 60fps scroll target desktop.

## 6. Definition of done (self-check before handing to QA)
Serve repo root, then confirm: page loads with zero console errors; orbit completes exactly one
revolution over hero scroll; letters/subtitle/stats/pillars/cards/finale all animate; both CTAs
and all nav links resolve; reduced-motion mode readable and static; window ≤390px wide is clean
(no horizontal scroll); WebGL-disabled fallback doesn't break layout. Then write `README.md`
(what this is, how to serve locally, placeholder list: [SETUP FEE], [MONTHLY PRICE], socials,
mailto, og:image) and `.gitignore` (OS junk only — nothing generated).
