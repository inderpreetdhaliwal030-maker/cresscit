# PREVIEW MACHINE — Build Spec (addendum to BUILD_SPEC.md)
The "See My Free Preview" CTA becomes an interactive overlay: visitor types their business
name, picks a vertical, and watches a miniature mock homepage for THEIR business assemble
itself. Copy comes from `content/copy.md` section "## PREVIEW MACHINE" — verbatim.

## Architecture & perf (hard requirements)
- New module `js/preview-machine.js`, **dynamically imported on first trigger click** — zero
  bytes in the initial load. Its styles live in `css/main.css` under
  `<!-- @component: preview-machine -->` (a few KB is fine; no new files/libs/requests).
- Triggers: the finale primary CTA **and** the nav "Get Started" button get
  `data-preview-trigger`. Keep their existing `href="mailto:…"` as the no-JS fallback; JS
  `preventDefault()`s and opens the overlay. Second click reuses the loaded module.
- User input is rendered with `textContent` ONLY — never interpolated into HTML strings.
  Nothing is stored or sent anywhere; the name appears only in their own mailto handoff.

## The overlay (a11y-correct dialog)
- Full-screen fixed overlay, ink backdrop (blur + darken), centered panel, film grain
  stays. `role="dialog" aria-modal="true"` labelled by the overlay headline.
- Focus: trapped and cycling within the dialog; initial focus on the name input; restored
  to the trigger on close. Close = X button (aria-label from copy), Esc, backdrop click.
- Scroll: lock the page while open (stop Lenis + body overflow); overlay content itself
  scrolls if taller than the viewport (critical at 375px).
- Form: labelled text input (business name, placeholder from copy; empty ⇒ fall back to
  the copy's nav-brand fallback) + a radiogroup of the four vertical chips (real radio
  inputs, styled; keyboard arrows work natively) + "build" button.

## The build sequence (the show)
1. On submit: status line (aria-live="polite") appears; then a mock browser frame renders.
2. Frame chrome: three dots + URL bar reading `<slug>.com` where slug = name lowercased,
   non-alphanumerics → single dashes, trimmed (e.g. "Ember & Oak" → `ember-oak.com`).
3. Inside, the mini-homepage assembles **section by section**: mini-nav → mini-hero (their
   name in the headline template) → three vertical-specific section blocks → mini-footer.
   Stagger ~350ms apart (~2.2s total), each landing with a brief emerald scanline/flash
   sweep (the FORGE made personal). `prefers-reduced-motion`: everything appears at once.
4. Per-vertical mini-site theming via scoped custom properties on the frame (do NOT touch
   global tokens): restaurant = warm cream/terracotta, serif-feeling weight contrast;
   trades = slate + safety-blue, sturdy; clinic = soft off-white + muted teal, airy;
   other = Cresscit-neutral (ink/emerald/cream). Section content per vertical from copy.md
   (restaurant: menu/reservations/hours-style blocks; trades: gallery grid + quote block;
   clinic: services rows + booking pill; other: generic services/about/contact).
   Blocks are skeleton-style shapes + the short copy strings — legible but miniature.
5. Device toggle after assembly: Desktop / Phone pill above the frame — swaps frame
   width/aspect (content reflows via container-relative sizing). Rebuild not required.
6. After assembly completes: post-reveal line + primary CTA (label from copy) →
   `mailto:hello@cresscit.com?subject=Free preview request — <NAME> (<vertical>)` with a
   one-line prefilled body; URL-encode properly. Microline under. "Try another" affordance
   (small text button) resets to the form with previous name retained.

## Definition of done (self-verify live before handing to QA)
Both triggers open it; focus trap + Esc + backdrop + X all work and focus restores; all
four verticals render visibly distinct palettes with the name interpolated; slug edge
cases (empty name, emoji/punctuation-only name) degrade gracefully; device toggle works;
reduced-motion instant; 375×812 fully usable (scroll inside overlay, keyboard doesn't
break layout); zero console errors; initial-load network identical to today (module only
fetched after click). Update README placeholder table (mailto now lives in the machine too).
