# THE CONTINUOUS 3D WORLD — Build Spec
One persistent WebGL scene behind the ENTIRE page. Scrolling drives a single camera
timeline through "stations" aligned with the DOM sections. The DOM keeps all text, CTAs,
overlays, a11y and SEO — the world is pure atmosphere and object performance behind it.
This is the flagship's defining feature; craft accordingly.

## Architecture
- `js/hero-scene.js` evolves into the world module (keep the filename — the lazy-load
  wiring, interaction trigger, 6s fallback, `.webgl-ready` crossfade, context-loss and
  no-WebGL probes all stay exactly as shipped).
- ONE fixed full-viewport canvas behind all content (`position:fixed; inset:0`,
  z-index below all sections, `pointer-events:none`, `aria-hidden`). The hero's current
  in-section canvas becomes this global layer; the hero poster/fallback behavior is
  unchanged.
- Global scroll progress P (0→1 over full document height, fed from the existing rAF/
  Lenis loop) drives a keyframed camera path + per-station object timelines. Ease
  between keyframes with smoothstep; never snap.
- Station manager: each station owns its objects; only the active station ± its
  neighbors are `visible`/updated — everything else is culled. One shared emerald dust
  particle system persists throughout (slow drift + scroll parallax).
- All textures procedural or CanvasTexture (the established mini-UI technique). No new
  network requests, no new libraries.

## The camera journey (stations ↔ scroll ranges, tune ±3%)
1. **MONOLITH ORBIT — hero, P 0–.18**: exactly today's behavior (one full orbit across
   the hero's pinned range, same lighting, same UI face). Do not regress this.
2. **RECESSION — stats strip, P .18–.28**: the monolith drifts back and down into the
   void, shrinking; dust parallax deepens; world dims ~40% so the count-up numbers own
   the frame.
3. **THE FORGE — pillars, P .28–.55**: camera glides forward into a loose 3D field of
   9–12 floating holographic browser windows (thin emissive planes, emerald wire edges,
   skeleton-UI CanvasTextures with shimmer — replace/retire the DOM `.forge__window`
   layer when WebGL is live). Windows drift idly; as each pillar third activates, a
   different cluster of 3–4 windows brightens and its skeleton bars "assemble". Camera
   drifts laterally per third (pillar 1 → left cluster, 2 → center, 3 → right).
4. **THE DELIVERY — work, P .55–.75**: the window field parts; camera dollies down a
   dark gallery lane lined with three large angled 3D screens, each showing an emissive
   mini-site texture themed like the three concept cards (restaurant warm / trades slate-
   blue / clinic teal — reuse the Preview Machine's palette logic as texture drawing).
   Each screen pulses emerald as the camera passes it, timed to its DOM card entering
   the viewport.
5. **THE CALM — steps + pricing, P .75–.88**: gallery fades behind; sparse dust, a
   faint floor-reflection gradient, the monolith silhouette re-approaching far ahead.
   Keep contrast low behind the pricing text.
6. **THE RETURN — finale, P .88–1**: the monolith arrives close, front-facing, slightly
   larger than the hero framing, emerald rim flaring in a slow pulse behind "GET YOUR
   SITE LIVE THIS WEEK." — the product looming behind the ask. Footer: world holds still.

## DOM interplay
- When `.webgl-ready`: hide the decorative CSS layers the world replaces (forge DOM
  windows; the work cards KEEP their DOM mockups — the 3D screens are behind/between,
  not a replacement for card content). Text/cards/buttons never move to canvas.
- Without WebGL or with reduced motion: everything behaves exactly as today (CSS forge
  windows, static poster, full readability). The world is progressive enhancement only.
- Overlays (Preview Machine, Quote Form): pause world rendering while an overlay is
  open (reuse the pause hook pattern from hero visibility).

## Performance budget (hard gate)
- Mobile Lighthouse Performance ≥95 (lazy interaction-load already keeps the module out
  of the trace — preserve that); desktop ≥95.
- Desktop scroll ≥55 FPS avg; no sustained <30 window. Mobile DPR clamp 1.25, desktop
  1.75 as today. Draw calls: keep total scene <60 draw calls; merge geometries where
  easy; one shared material per window/screen family with per-instance emissive tint.
- CanvasTexture redraws throttled (every 3rd frame max, only for the active station).
- Zero CLS: canvas is fixed and behind; nothing layout-affecting.
- Tab-hidden pause; canvas render skipped when an overlay is open or document hidden.

## Definition of done (self-verify live before QA)
Full-page scroll walkthrough at 1280×800: every station transition smooth, no pops, no
station visible outside its range ± transition; hero orbit byte-identical in feel;
FORGE clusters track the pillar thirds; DELIVERY screens pulse with their cards; finale
monolith frames the CTA. FPS sampled across the FULL scroll (not just hero). 375×812:
world visible but calmer (fewer windows OK), text always owns contrast. Reduced-motion
and no-WebGL paths regress to today's behavior. Console clean. Both overlays still
open/close with world paused. Screenshots per station to qa-evidence\flagship\
(world-1-hero.png … world-6-return.png) + world-mobile.png.
