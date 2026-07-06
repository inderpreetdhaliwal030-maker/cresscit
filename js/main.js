/* ==========================================================================
   CRESSCIT — Site behavior
   ONE rAF loop drives: Lenis (smooth scroll) · hero render · scroll-progress
   callbacks. Everything else is IntersectionObserver or event-driven.

   Tiny hand-rolled scroll engine: onProgress(el, fn) computes 0→1 progress of
   an element's scroll range from getBoundingClientRect each frame and calls
   fn(p). Only ~3 sections subscribe, so this is cheap.

   PERF NOTE: js/hero-scene.js (and, through it, the ~654 KB three.js module)
   is loaded via DYNAMIC import on first user interaction (~6s-after-load
   fallback) — never statically — so three.js download+eval stays out of the
   initial load entirely (mobile LCP/TBT/Lighthouse trace). The bare 'three'
   specifier still resolves through the import map in index.html. Until the
   scene is ready, the CSS poster slab (.hero__fallback) is visible.
   ========================================================================== */

const prefersReduced =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* --------------------------------------------------------------------------
   Scroll-progress engine
   -------------------------------------------------------------------------- */
const progressSubs = [];
/** Register a callback with 0→1 progress across an element's scroll range. */
function onProgress(el, fn) {
  if (!el) return;
  progressSubs.push({ el, fn });
}
function runProgress() {
  const vh = window.innerHeight;
  for (const { el, fn } of progressSubs) {
    const r = el.getBoundingClientRect();
    // 0 when the element's top hits the viewport top;
    // 1 when its bottom reaches the viewport bottom (full scroll travel).
    const travel = r.height - vh;
    const p = travel > 0 ? clamp01(-r.top / travel) : 0;
    fn(p);
  }
}

/* --------------------------------------------------------------------------
   Hero — split in two so three.js never blocks first paint:

   1. setupHeroChoreo()  — DOM-only kinetic type (letters/subtitle/hint),
      bound at boot. Works whether or not the WebGL scene ever loads; the
      scene hook inside the callback is null-guarded.
   2. scheduleHeroScene() — lazy-init on FIRST USER INTERACTION (pointermove /
      pointerdown / touchstart / keydown / wheel / scroll — whichever fires
      first), with a generous ~6s-after-load fallback timer for completely
      passive viewers. NOT requestIdleCallback: on an idle page that fires
      almost immediately after load, which would put three.js download+eval
      back inside the Lighthouse trace window. A single loadOnce() gate
      guards the interaction/timer race; all listeners detach on first fire.
      Until then the CSS poster slab (.hero__fallback, visible by default)
      holds the frame — absolutely positioned, so zero layout shift. On
      success, `.webgl-ready` crossfades canvas in / poster out (~400ms).
      On failure or no WebGL, `.no-webgl` keeps the poster permanently.

   Reduced motion: WebGL is skipped ENTIRELY — the static CSS poster slab is
   the reduced-motion monolith (three.js never downloads). Documented in
   README. Everything stays readable via the CSS reduced-motion overrides.
   -------------------------------------------------------------------------- */
const heroSection = document.querySelector('[data-hero]');
const heroCanvas = document.querySelector('[data-hero-canvas]');
let hero = null;       // set late by scheduleHeroScene() — ALWAYS null-guard
let heroVisible = true;

function setupHeroChoreo() {
  const letters = document.querySelectorAll('[data-hero-title] span');
  const subtitle = document.querySelector('[data-hero-sub]');
  const hint = document.querySelector('[data-hero-hint]');
  const N = letters.length;
  if (prefersReduced || !heroSection) return;

  onProgress(heroSection, (p) => {
    if (hero) hero.setProgress(p);   // scene may not have loaded yet

    // Letters track in across p 0 → 0.35, staggered per letter.
    const span = 0.35;
    for (let i = 0; i < N; i++) {
      const start = (i / N) * span * 0.6;         // staggered starts
      const lp = clamp01((p - start) / (span - start + 0.0001));
      const el = letters[i];
      el.style.opacity = lp;
      el.style.transform = `translateY(${(1 - lp) * 1.1}em)`;
      el.style.filter = `blur(${(1 - lp) * 14}px)`;
    }

    // Subtitle fades in p 0.05 → 0.2, then stays.
    const sp = clamp01((p - 0.05) / 0.15);
    subtitle.style.opacity = sp;
    subtitle.style.transform = `translateY(${(1 - sp) * 12}px)`;

    // Scroll hint fades in with subtitle, fades out after p 0.5.
    const hin = clamp01((p - 0.05) / 0.15);
    const hout = 1 - clamp01((p - 0.5) / 0.1);
    hint.style.opacity = Math.min(hin, hout);
  });
}

function scheduleHeroScene() {
  // Reduced motion: keep the static CSS poster; never load three.js.
  if (prefersReduced || !heroCanvas) return;

  // First-interaction triggers. 'scroll' + 'wheel' cover both native scroll
  // and Lenis (its virtual scroll consumes 'wheel', then writes scrollTop,
  // which fires native 'scroll' — either way we hear the first one).
  const TRIGGERS = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
  const FALLBACK_MS = 6000;   // passive viewer still gets the scene ~6s after load
  let fired = false;
  let fallbackTimer = 0;

  async function initScene() {
    try {
      const mod = await import('./hero-scene.js');
      hero = mod.initHeroScene(heroCanvas, { reducedMotion: false });
    } catch (e) {
      hero = null;                    // load/init failed — poster stays
    }
    if (!hero) {
      document.documentElement.classList.add('no-webgl');
      return;
    }
    hero.resize();
    // Crossfade: canvas fades in, poster fades out (CSS, ~400ms).
    document.documentElement.classList.add('webgl-ready');

    // Pause rendering while the hero is offscreen (perf).
    if ('IntersectionObserver' in window && heroSection) {
      const io = new IntersectionObserver(
        ([entry]) => { heroVisible = entry.isIntersecting; },
        { threshold: 0 }
      );
      io.observe(heroSection);
    }
  }

  // Single gate: first trigger OR fallback timer wins; the rest are inert.
  function loadOnce() {
    if (fired) return;
    fired = true;
    clearTimeout(fallbackTimer);
    TRIGGERS.forEach((t) => window.removeEventListener(t, loadOnce));
    initScene();
  }

  TRIGGERS.forEach((t) => window.addEventListener(t, loadOnce, { passive: true }));

  const armFallback = () => { fallbackTimer = setTimeout(loadOnce, FALLBACK_MS); };
  if (document.readyState === 'complete') armFallback();
  else window.addEventListener('load', armFallback, { once: true });
}

/* --------------------------------------------------------------------------
   Nav: gains tint/blur/border once scrolled past 60vh
   -------------------------------------------------------------------------- */
function setupNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const update = () => {
    const past = window.scrollY > window.innerHeight * 0.6;
    nav.classList.toggle('is-scrolled', past);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* --------------------------------------------------------------------------
   Shared reveal observer (adds .is-in)
   -------------------------------------------------------------------------- */
function setupReveals() {
  const els = document.querySelectorAll('.reveal');
  if (prefersReduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
  );
  els.forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Stats count-up (once, when ≥50% visible)
   -------------------------------------------------------------------------- */
function setupStats() {
  const nums = document.querySelectorAll('[data-count-to]');
  if (!nums.length) return;

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const render = (el, value, decimals) => {
    el.textContent = value.toFixed(decimals);
  };

  // Reduced motion / no IO: render final values immediately, no animation.
  if (prefersReduced || !('IntersectionObserver' in window)) {
    nums.forEach((el) => {
      render(el, parseFloat(el.dataset.countTo), +el.dataset.countDecimals || 0);
    });
    return;
  }

  const animate = (el) => {
    const target = parseFloat(el.dataset.countTo);
    const decimals = +el.dataset.countDecimals || 0;
    const duration = 900;
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp01((now - t0) / duration);
      render(el, target * easeOut(t), decimals);
      if (t < 1) requestAnimationFrame(step);
      else render(el, target, decimals);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          animate(e.target);
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.5 }
  );
  nums.forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Pillars crossfade — each pillar owns a third of the section's progress
   -------------------------------------------------------------------------- */
function setupPillars() {
  const section = document.querySelector('[data-pillars]');
  const pillars = document.querySelectorAll('[data-pillar]');
  const windows = document.querySelectorAll('.forge__window');
  if (!section || !pillars.length) return;

  if (prefersReduced) {
    pillars.forEach((p) => p.classList.add('is-active'));
    return;
  }

  onProgress(section, (p) => {
    // Which third are we in → active pillar (no dead zones).
    const idx = Math.min(pillars.length - 1, Math.floor(p * pillars.length));
    pillars.forEach((el, i) => el.classList.toggle('is-active', i === idx));

    // Parallax the holographic windows by depth factor.
    windows.forEach((w) => {
      const depth = parseFloat(w.dataset.depth) || 0.2;
      w.style.marginTop = `${(p - 0.5) * depth * 260}px`;
    });
  });
}

/* --------------------------------------------------------------------------
   Finale — words reveal on scroll (translateY + opacity stagger)
   -------------------------------------------------------------------------- */
function setupFinale() {
  const section = document.querySelector('#contact');
  const words = document.querySelectorAll('[data-finale] .word');
  if (!section || !words.length) return;

  if (prefersReduced) {
    words.forEach((w) => { w.style.opacity = 1; w.style.transform = 'none'; });
    return;
  }

  const N = words.length;
  onProgress(section, (p) => {
    // Reveal window: play across p 0.1 → 0.6 of this 160vh section.
    const play = clamp01((p - 0.1) / 0.5);
    words.forEach((w, i) => {
      const start = (i / N) * 0.7;
      const wp = clamp01((play - start) / (1 - start + 0.0001));
      w.style.opacity = wp;
      w.style.transform = `translateY(${(1 - wp) * 0.5}em)`;
    });
  });
}

/* --------------------------------------------------------------------------
   Work cards — tilt toward cursor (fine pointers only)
   -------------------------------------------------------------------------- */
function setupCardTilt() {
  if (prefersReduced || !finePointer) return;
  const cards = document.querySelectorAll('[data-card]');
  cards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 → 0.5
      const dy = (e.clientY - r.top) / r.height - 0.5;
      const max = 6; // degrees
      card.style.transform =
        `perspective(900px) rotateY(${dx * max}deg) rotateX(${-dy * max}deg) scale(1.02)`;
      card.style.boxShadow = 'var(--shadow-glow)';
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
  });
}

/* --------------------------------------------------------------------------
   Lenis smooth scroll (desktop). Native scroll on touch (syncTouch default).
   -------------------------------------------------------------------------- */
let lenis = null;
function setupLenis() {
  if (prefersReduced || typeof window.Lenis === 'undefined') return;
  lenis = new window.Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  // Anchor links routed through Lenis for a smooth glide.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    });
  });
}

/* --------------------------------------------------------------------------
   THE single rAF loop
   -------------------------------------------------------------------------- */
function startLoop() {
  function frame(now) {
    if (lenis) lenis.raf(now);
    runProgress();
    if (hero && heroVisible) hero.render(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
function boot() {
  setupHeroChoreo();     // DOM kinetic type — live before the scene loads
  scheduleHeroScene();   // three.js waits for first interaction (or ~6s)
  setupNav();
  setupReveals();
  setupStats();
  setupPillars();
  setupFinale();
  setupCardTilt();
  setupLenis();

  // Run progress once so initial (above-the-fold) state is correct.
  runProgress();
  startLoop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
