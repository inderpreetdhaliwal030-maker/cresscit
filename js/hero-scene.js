/* ==========================================================================
   CRESSCIT — The Continuous World (WebGL)
   ES module. ONE persistent scene behind the ENTIRE page. A single camera
   timeline, driven by global scroll progress P (0→1 over the whole document),
   travels through six "stations" aligned to the DOM sections. The DOM keeps
   all text/cards/CTAs; this canvas is fixed behind everything, aria-hidden,
   pointer-events:none — pure atmosphere + object performance.

   Filename kept as hero-scene.js: the lazy-load wiring in js/main.js
   (interaction trigger, ~6s fallback, `.webgl-ready` crossfade, context-loss
   and no-WebGL probes) is unchanged and sacred.

   Exposes a controller so js/main.js drives render + progress from ONE shared
   rAF loop — this module never starts its own loop.

   ── Camera journey (station ↔ P range; the DOM sections are laid out so these
      land on the right content) ─────────────────────────────────────────────
     1 MONOLITH ORBIT   P 0    – 0.18  hero: exactly today's one-orbit behavior
     2 RECESSION        P 0.18 – 0.28  monolith drifts back/down, world dims
     3 THE FORGE        P 0.28 – 0.55  field of holographic browser windows
     4 THE DELIVERY     P 0.55 – 0.75  gallery lane of three angled site screens
     5 THE CALM         P 0.75 – 0.88  sparse dust, monolith re-approaching afar
     6 THE RETURN       P 0.88 – 1.00  monolith arrives close, front-facing

   Hero orbit contract (unchanged): the monolith's rotation/dolly during
   station 1 is driven by the HERO SECTION's own local progress (0→1 over its
   pinned 300vh), so the "one full orbit over the pinned hero" feel is
   byte-identical to the shipped hero. Global P only takes the wheel once we
   leave the hero (recession onward).

   Fallback: if WebGL is unavailable, initHeroScene() returns null and main.js
   flags `.no-webgl` so the CSS poster shows instead — layout never breaks.
   ========================================================================== */

import * as THREE from 'three';

const TAU = Math.PI * 2;

/* smoothstep — the ONLY easing between keyframes. No snaps anywhere. */
const smoothstep = (a, b, x) => {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 at edges, 1 in the middle of [a,b] — a windowed "activeness" ramp. */
const window01 = (a, b, x) => {
  const m = (a + b) / 2;
  return Math.min(smoothstep(a, m, x), 1 - smoothstep(m, b, x));
};

/* Station boundaries (P). Tunable ±3% per spec. */
const ST = {
  orbitEnd:     0.18,
  recessEnd:    0.28,
  forgeEnd:     0.55,
  deliveryEnd:  0.75,
  calmEnd:      0.88,
  // returnEnd = 1.0
};

/* --- WebGL capability probe (before we touch three's renderer) ----------- */
export function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

/* ==========================================================================
   Shared 2D drawing helpers (rounded rects on offscreen canvases).
   ========================================================================== */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PAL = {
  INK: '#0a0a0c', INK2: '#101014', INK3: '#16161c',
  EMER: '#19e08c', EMER_DEEP: '#0b9159', CREAM: '#f4efe4', DIM: '#b9b4a6',
};

/* ==========================================================================
   MONOLITH screen texture — the mini website UI (unchanged from the shipped
   hero). Redrawn every 3rd frame (throttled). Shimmer sweep + blinking cursor
   so it reads as a *live* site. Brand palette only.
   ========================================================================== */
function createScreenTexture() {
  const W = 512, H = 792;                 // portrait, matches slab face ratio
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  const { INK, INK2, INK3, EMER, EMER_DEEP, CREAM, DIM } = PAL;

  const texture = new THREE.CanvasTexture(cvs);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const roundRect = (x, y, w, h, r) => roundRectPath(ctx, x, y, w, h, r);

  function draw(t) {
    // t = seconds since start (drives shimmer + cursor blink)
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, INK2);
    bg.addColorStop(1, INK);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Nav bar
    ctx.fillStyle = CREAM;
    ctx.font = '600 26px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('CRESSCIT', 34, 44);
    ctx.fillStyle = DIM;
    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillText('Work', 300, 44);
    ctx.fillText('Pricing', 358, 44);
    ctx.fillStyle = EMER;
    roundRect(438, 30, 44, 28, 14); ctx.fill();

    // Hero block
    ctx.fillStyle = CREAM;
    ctx.font = '400 76px "Bebas Neue", "Arial Narrow", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('YOUR SITE,', 34, 190);
    ctx.fillText('LIVE.', 34, 256);

    // blinking cursor after headline
    if (Math.floor(t * 1.4) % 2 === 0) {
      ctx.fillStyle = EMER;
      ctx.fillRect(196, 214, 10, 44);
    }

    ctx.fillStyle = DIM;
    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillText('We build it and run it — forever.', 34, 296);

    // Emerald CTA button
    ctx.fillStyle = EMER;
    roundRect(34, 322, 190, 52, 26); ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = '600 18px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Get started', 66, 349);

    // Three cards
    const cardY = 430, cardH = 300, gap = 18;
    const cardW = (W - 68 - gap * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const x = 34 + i * (cardW + gap);
      ctx.fillStyle = INK3;
      roundRect(x, cardY, cardW, cardH, 14); ctx.fill();
      ctx.fillStyle = i === 1 ? EMER : EMER_DEEP;
      roundRect(x + 16, cardY + 20, cardW - 32, 70, 8); ctx.fill();
      ctx.fillStyle = 'rgba(244,239,228,0.28)';
      roundRect(x + 16, cardY + 108, cardW - 40, 8, 4); ctx.fill();
      roundRect(x + 16, cardY + 128, cardW - 60, 8, 4); ctx.fill();
      roundRect(x + 16, cardY + 148, cardW - 30, 8, 4); ctx.fill();
      ctx.fillStyle = EMER;
      roundRect(x + 16, cardY + cardH - 44, 64, 24, 12); ctx.fill();
    }

    // Shimmer sweep
    const sweep = ((t * 0.16) % 1.4) - 0.2;
    const sy = sweep * H;
    const grad = ctx.createLinearGradient(0, sy - 120, W, sy + 120);
    grad.addColorStop(0, 'rgba(25,224,140,0)');
    grad.addColorStop(0.5, 'rgba(25,224,140,0.10)');
    grad.addColorStop(1, 'rgba(25,224,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Inner border to sell the "screen"
    ctx.strokeStyle = 'rgba(25,224,140,0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    texture.needsUpdate = true;
  }

  draw(0);
  return { texture, draw };
}

/* ==========================================================================
   FORGE window texture — a skeleton-UI browser window (traffic-light dots,
   nav, headline block, skeleton bars). A single canvas is drawn ONCE per
   variant and shared as the emissive map for that window family; the per-frame
   "assemble" shimmer is done with an emissive-intensity tint on the material,
   not by redrawing (keeps CanvasTexture redraws off the hot path).
   ========================================================================== */
function createForgeTexture(variant) {
  const W = 320, H = 220;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');
  const { INK2, INK3, EMER, CREAM, DIM } = PAL;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(18,18,24,0.96)');
  bg.addColorStop(1, 'rgba(9,9,13,0.96)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Title bar
  ctx.fillStyle = 'rgba(25,224,140,0.10)';
  ctx.fillRect(0, 0, W, 30);
  const dots = ['rgba(25,224,140,0.9)', 'rgba(244,239,228,0.3)', 'rgba(244,239,228,0.3)'];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.fillStyle = dots[i];
    ctx.arc(18 + i * 16, 15, 4.5, 0, TAU);
    ctx.fill();
  }
  // url pill
  ctx.fillStyle = 'rgba(10,10,12,0.6)';
  roundRectPath(ctx, 84, 8, 150, 15, 7); ctx.fill();

  // Body — nav row
  ctx.fillStyle = CREAM;
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('SITE', 16, 50);
  ctx.fillStyle = 'rgba(244,239,228,0.22)';
  roundRectPath(ctx, W - 96, 44, 20, 6, 3); ctx.fill();
  roundRectPath(ctx, W - 68, 44, 20, 6, 3); ctx.fill();
  roundRectPath(ctx, W - 40, 44, 24, 6, 3); ctx.fill();

  // Hero headline block (variant-tinted accent)
  const accents = ['#19e08c', '#0b9159', '#19e08c'];
  ctx.fillStyle = accents[variant % 3];
  roundRectPath(ctx, 16, 66, 150, 34, 6); ctx.fill();
  // skeleton bars
  const barW = [190, 150, 210, 120];
  ctx.fillStyle = 'rgba(244,239,228,0.16)';
  for (let i = 0; i < 4; i++) {
    roundRectPath(ctx, 16, 112 + i * 16, barW[i], 8, 4); ctx.fill();
  }
  // an emerald "block" placeholder
  ctx.fillStyle = 'rgba(25,224,140,0.18)';
  roundRectPath(ctx, 16, 182, 120, 26, 6); ctx.fill();
  ctx.fillStyle = EMER;
  roundRectPath(ctx, 150, 184, 60, 22, 11); ctx.fill();

  const texture = new THREE.CanvasTexture(cvs);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

/* ==========================================================================
   DELIVERY screen texture — an emissive mini-site homepage themed per vertical
   (restaurant warm / trades slate-blue / clinic teal), reusing the Preview
   Machine's palette logic as texture drawing. Drawn once; the per-pass emerald
   pulse is done via emissiveIntensity on the material.
   ========================================================================== */
const DELIVERY_THEMES = [
  { // restaurant — warm cream
    bg: '#f7efdd', surface: '#fffaf0', ink: '#38251a', muted: '#8a6f5b',
    accent: '#bd4f1c', accentInk: '#fff6ec', brand: 'EMBER & OAK',
    tag: 'Wood-fired kitchen', cta: 'Reserve',
  },
  { // trades — slate-blue
    bg: '#232932', surface: '#2d3641', ink: '#edf2f8', muted: '#94a2b4',
    accent: '#2f7bdb', accentInk: '#f2f7ff', brand: 'HALDEN BROS.',
    tag: 'General contracting', cta: 'Get a quote',
  },
  { // clinic — teal
    bg: '#f2f7f5', surface: '#ffffff', ink: '#24403a', muted: '#7d968f',
    accent: '#3f8f7d', accentInk: '#f2fbf7', brand: 'WILLOWMERE',
    tag: 'Family clinic', cta: 'Book online',
  },
];

function createDeliveryTexture(theme) {
  const W = 640, H = 400;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');
  const rr = (x, y, w, h, r) => roundRectPath(ctx, x, y, w, h, r);

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // top nav
  ctx.fillStyle = theme.ink;
  ctx.font = '700 22px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(theme.brand, 34, 40);
  ctx.fillStyle = theme.muted;
  ctx.font = '500 14px Inter, sans-serif';
  ctx.fillText('Menu', W - 220, 40);
  ctx.fillText('About', W - 160, 40);
  ctx.fillStyle = theme.accent;
  rr(W - 96, 26, 62, 28, 14); ctx.fill();
  ctx.fillStyle = theme.accentInk;
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillText(theme.cta, W - 84, 41);

  // hero band
  ctx.fillStyle = theme.surface;
  rr(34, 72, W - 68, 150, 14); ctx.fill();
  ctx.fillStyle = theme.ink;
  ctx.font = '700 40px Georgia, serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(theme.brand, 60, 140);
  ctx.fillStyle = theme.accent;
  ctx.font = '600 18px Inter, sans-serif';
  ctx.fillText(theme.tag, 60, 174);
  ctx.fillStyle = theme.accent;
  rr(60, 188, 130, 24, 12); ctx.fill();

  // three feature cards
  const cy = 244, ch = 118, gap = 20;
  const cw = (W - 68 - gap * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const x = 34 + i * (cw + gap);
    ctx.fillStyle = theme.surface;
    rr(x, cy, cw, ch, 12); ctx.fill();
    ctx.fillStyle = theme.accent;
    rr(x + 14, cy + 16, 40, 40, 8); ctx.fill();
    ctx.fillStyle = theme.muted;
    rr(x + 14, cy + 68, cw - 40, 8, 4); ctx.fill();
    rr(x + 14, cy + 84, cw - 60, 8, 4); ctx.fill();
  }

  const texture = new THREE.CanvasTexture(cvs);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* ==========================================================================
   Scene controller
   ========================================================================== */
export function initHeroScene(canvas, { reducedMotion = false } = {}) {
  if (!canvas || !webglSupported()) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    return null;
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dprCap = coarse ? 1.25 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05050a, 0.085);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0, 0, 6.2);

  /* ---- Root that everything hangs off. The camera stays near origin and we
     translate the WORLD along -Z as we progress (cheaper + keeps fog framing
     stable). Each station group is positioned in this world space. -------- */
  const world = new THREE.Group();
  scene.add(world);

  /* ======================================================================
     STATION 1 — MONOLITH (also re-used for station 6 RETURN)
     The slab + live screen face. Lives in SCENE space (NOT the travelling
     `world` group) so its recession/return positions are computed relative to
     the camera — otherwise the world's forward translation would carry it far
     behind the camera by the finale. Positioned each frame in applyProgress().
     ====================================================================== */
  const monolith = new THREE.Group();
  scene.add(monolith);

  const SLAB_W = 2.2, SLAB_H = 3.4, SLAB_D = 0.28;
  const slabGeo = new THREE.BoxGeometry(SLAB_W, SLAB_H, SLAB_D);
  const slabMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0b0e,
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.15,
  });
  const slab = new THREE.Mesh(slabGeo, slabMat);
  monolith.add(slab);

  const { texture: screenTex, draw: drawScreen } = createScreenTexture();
  const screenGeo = new THREE.PlaneGeometry(SLAB_W * 0.86, SLAB_H * 0.9);
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 1.15,
    roughness: 0.5,
    metalness: 0.0,
    toneMapped: false,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = SLAB_D / 2 + 0.02;
  monolith.add(screen);

  /* ======================================================================
     STATION 3 — THE FORGE: a loose 3D field of holographic browser windows.
     Three CLUSTERS of 3-4 windows (left / center / right) so each pillar
     third can brighten its own cluster. Thin emissive planes with emerald
     wire edges. ONE shared material per texture-variant with per-instance
     emissive tint via a cloned material (still one draw call each; count is
     modest — 10 windows). Windows drift idly (sin on their base offset).
     ====================================================================== */
  const forge = new THREE.Group();
  forge.visible = false;
  world.add(forge);

  const forgeTexA = createForgeTexture(0);
  const forgeTexB = createForgeTexture(1);
  const forgeTexC = createForgeTexture(2);
  const forgeGeo = new THREE.PlaneGeometry(1.7, 1.17);
  // shared edge geometry (emerald wire border) — one per window, cheap lines
  const edgeGeo = new THREE.EdgesGeometry(forgeGeo);

  // cluster layout: [clusterIndex] → array of window descriptors
  // x roughly groups left(-)/center(0)/right(+); z spreads depth in the lane.
  const WINDOW_DEFS = [
    // cluster 0 — LEFT (pillar 1)
    { cluster: 0, x: -3.4, y: 1.1, z: -2.0, s: 1.05, tex: forgeTexA, rot: 0.18 },
    { cluster: 0, x: -2.5, y: -0.9, z: -3.6, s: 0.86, tex: forgeTexB, rot: 0.12 },
    { cluster: 0, x: -4.1, y: -0.2, z: -1.2, s: 0.7, tex: forgeTexC, rot: 0.24 },
    // cluster 1 — CENTER (pillar 2)
    { cluster: 1, x: 0.2, y: 1.4, z: -3.0, s: 0.95, tex: forgeTexB, rot: -0.05 },
    { cluster: 1, x: -0.6, y: -1.2, z: -1.8, s: 1.1, tex: forgeTexC, rot: 0.08 },
    { cluster: 1, x: 1.1, y: 0.1, z: -4.4, s: 0.78, tex: forgeTexA, rot: -0.12 },
    { cluster: 1, x: 0.5, y: -0.4, z: -0.8, s: 0.64, tex: forgeTexB, rot: 0.1 },
    // cluster 2 — RIGHT (pillar 3)
    { cluster: 2, x: 3.5, y: 1.0, z: -2.4, s: 1.02, tex: forgeTexC, rot: -0.2 },
    { cluster: 2, x: 2.6, y: -1.0, z: -3.8, s: 0.84, tex: forgeTexA, rot: -0.14 },
    { cluster: 2, x: 4.2, y: 0.3, z: -1.4, s: 0.72, tex: forgeTexB, rot: -0.26 },
  ];

  const forgeWindows = WINDOW_DEFS.map((def) => {
    const mat = new THREE.MeshBasicMaterial({
      map: def.tex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(forgeGeo, mat);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x19e08c, transparent: true, opacity: 0.5,
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(edges);
    mesh.position.set(def.x, def.y, def.z);
    mesh.rotation.y = def.rot;
    mesh.scale.setScalar(def.s);
    mesh.userData = { def, mat, edgeMat, baseY: def.y, phase: Math.random() * TAU };
    forge.add(mesh);
    return mesh;
  });
  // The forge lane sits ahead of the monolith along -Z.
  forge.position.z = -14;

  /* ======================================================================
     STATION 4 — THE DELIVERY: a dark gallery lane lined with three large
     angled screens (restaurant / trades / clinic), each an emissive mini-site
     texture. Camera dollies down the lane; each screen pulses as we pass it.
     ====================================================================== */
  const delivery = new THREE.Group();
  delivery.visible = false;
  world.add(delivery);

  const screenPlaneGeo = new THREE.PlaneGeometry(4.6, 2.87);
  const LANE_SPACING = 7.2;   // world-Z gap between consecutive gallery screens
  const deliveryScreens = DELIVERY_THEMES.map((theme, i) => {
    const tex = createDeliveryTexture(theme);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.96, toneMapped: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(screenPlaneGeo, mat);
    // Alternate sides of the lane, angled inward toward the camera sightline so
    // the camera "passes" each screen. Kept fairly head-on (small yaw) and near
    // the centre so each reads large as it comes up.
    const side = i % 2 === 0 ? -1 : 1;
    const baseZ = -i * LANE_SPACING;
    mesh.position.set(side * 2.4, 0.1, baseZ);
    mesh.rotation.y = -side * 0.34;   // angled to face the passing camera
    const frameEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(screenPlaneGeo),
      new THREE.LineBasicMaterial({ color: 0x19e08c, transparent: true, opacity: 0.4 })
    );
    mesh.add(frameEdges);
    mesh.userData = { mat, frameEdges, baseZ, side };
    delivery.add(mesh);
    return mesh;
  });
  // Placed so that, as the world translates forward across the delivery range,
  // the three screens sweep through the camera's framing one after another.
  // (delivery group Z is set each frame in applyProgress relative to worldZ.)
  delivery.position.z = 0;

  /* ======================================================================
     Shared EMERALD DUST — one persistent particle system for the whole world.
     Slow drift + scroll parallax (its group translates a little with P).
     ====================================================================== */
  const DUST = coarse ? 140 : 220;
  const positions = new Float32Array(DUST * 3);
  const speeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 8;
    speeds[i] = 0.04 + Math.random() * 0.09;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x19e08c,
    size: 0.03,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);   // dust rides in camera space, not world space

  /* ---- Lights (emerald key/rim, cool fill, faint top, ambient) --------- */
  const key = new THREE.SpotLight(0x19e08c, 90, 40, Math.PI / 4, 0.5, 1.2);
  key.position.set(-5, 3, -3);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);

  const fill = new THREE.PointLight(0x2b4a66, 14, 50, 1.4);
  fill.position.set(4, -1, 5);
  scene.add(fill);

  const top = new THREE.DirectionalLight(0xffffff, 0.4);
  top.position.set(0, 6, 2);
  scene.add(top);

  const ambient = new THREE.AmbientLight(0x0a0a10, 0.6);
  scene.add(ambient);

  /* ---- Sizing ---------------------------------------------------------- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- Context-loss handling ------------------------------------------ */
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    contextLost = true;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    resize();
  }, false);

  /* ======================================================================
     Progress state.
       P     — global document progress (0→1 over the whole page)
       heroP — hero-section-local progress (drives the byte-identical orbit)
     main.js feeds both via setProgress(P, heroP). Station visibility, camera
     path, dimming and per-station object timelines all key off P except the
     monolith's own rotation/dolly during station 1, which keys off heroP.
     ====================================================================== */
  let frame = 0;
  let P = 0;
  let heroP = 0;

  // camera scratch targets (so we can smoothstep-blend, never snap)
  const camPos = new THREE.Vector3(0, 0, 6.2);
  const camLook = new THREE.Vector3(0, 0, 0);

  function applyProgress(pGlobal, pHero) {
    P = clamp01(pGlobal);
    heroP = clamp01(pHero);

    /* ---------- MONOLITH: orbit (station 1) → recession → return --------
       The monolith lives in SCENE space; the camera hovers near Z≈5.4–6.2
       looking into -Z. We place the slab on the camera's sightline and move it
       in absolute scene coordinates:
         • hero      → Z 0 (centered ~2 units ahead of the look target)
         • recession → pushed deep to -Z and down, shrinking into the void
         • calm      → a faint far silhouette re-approaching from deep -Z
         • return    → arrives close (Z ~ -0.5), front-facing, slightly larger */
    const recede = smoothstep(ST.orbitEnd, ST.recessEnd, P);   // .18→.28
    // Far approach begins in calm so a silhouette is visible before the finale.
    const approach = smoothstep(ST.deliveryEnd, 1.0, P);       // .75→1

    /* ---------- WORLD forward travel (single keyframed camera timeline) ---
       Move the `world` group along +Z past a mostly-stationary camera. Computed
       up-front so the FORGE and DELIVERY blocks below can read world.position.z
       when placing their lanes relative to the camera framing. --------------- */
    let worldZ = 0;
    worldZ += smoothstep(ST.orbitEnd, ST.forgeEnd, P) * 14;      // into forge
    worldZ += smoothstep(ST.forgeEnd, ST.deliveryEnd, P) * 20;   // into gallery
    worldZ += smoothstep(ST.deliveryEnd, 1.0, P) * 10;           // through calm
    world.position.z = worldZ;

    // Absolute Z: hero 0 → recede to -9 → approach pulls it forward again, but
    // settling a little deeper than hero so the finale text has breathing room
    // and the slab reads as a backdrop behind the ask (not competing with it).
    const recedeZ = lerp(0, -9, recede);
    const approachZ = lerp(0, 9 - 2.2, approach); // undo recede (-9), settle at Z≈-2.2
    monolith.position.z = recedeZ + approachZ;
    monolith.position.y = lerp(0, -1.6, recede) * (1 - approach);
    monolith.position.x = 0;

    // Scale: shrink into the void on recede, grow back to ~1.08× hero on return
    // ("slightly larger than the hero framing" per spec — a backdrop, not a wall).
    const recedeScale = lerp(1, 0.5, recede);
    const returnScale = lerp(1, 1.08 / 0.5, approach); // net ~1.08× hero size
    monolith.scale.setScalar(recedeScale * returnScale);

    // Rotation: one orbit over the hero (heroP); on return settle to front-face.
    const yawSettle = smoothstep(ST.calmEnd, 0.98, P);
    monolith.rotation.y = lerp(heroP * TAU, 0, yawSettle);
    monolith.rotation.x = lerp(Math.sin(heroP * TAU) * 0.05, 0, yawSettle);

    // Visible near hero/recession and again through calm→return; culled through
    // the forge/delivery mid-journey to save draws.
    monolith.visible = (P < ST.recessEnd + 0.05) || (P > ST.deliveryEnd - 0.02);

    /* ---------- WORLD dimming (recession dims ~40%; calm stays low) ------ */
    // Emissive/light scale: full at hero, dimmed through recession/forge,
    // recovering into delivery, low again in calm, flaring on return.
    const recessionDim = 1 - 0.42 * window01(ST.orbitEnd, ST.forgeEnd, P);
    const calmDim = 1 - 0.35 * window01(ST.deliveryEnd, 1.0, P);
    const worldDim = Math.min(recessionDim, calmDim);
    key.intensity = 90 * worldDim;
    fill.intensity = 14 * worldDim;
    // Screen face stays bright when the monolith is the subject (hero + return),
    // otherwise it tracks the world dimming.
    screenMat.emissiveIntensity = 1.15 * (approach > 0.1 ? 1 : recessionDim);

    /* ---------- FORGE (station 3, P .28→.55) ---------------------------- */
    const forgeIn = smoothstep(ST.recessEnd - 0.02, ST.forgeEnd, P);
    const forgeOut = smoothstep(ST.forgeEnd - 0.02, ST.deliveryEnd - 0.02, P);
    const forgeVisual = forgeIn * (1 - forgeOut);
    forge.visible = P > ST.recessEnd - 0.05 && P < ST.deliveryEnd + 0.02;
    if (forge.visible) {
      // Which pillar third is active → which cluster brightens.
      // Map forge P-range onto 0→1, then into thirds.
      const forgeLocal = clamp01(
        (P - ST.recessEnd) / (ST.forgeEnd - ST.recessEnd)
      );
      // Camera drifts laterally per third: left → center → right.
      // (applied in the camera path below via forgeLateral)
      for (const w of forgeWindows) {
        const { def, mat, edgeMat } = w.userData;
        // cluster activeness: brightest when forgeLocal is in this third.
        const c0 = def.cluster / 3, c1 = (def.cluster + 1) / 3;
        const active = window01(c0 - 0.12, c1 + 0.12, forgeLocal);
        const base = 0.16 + 0.74 * forgeVisual;
        mat.opacity = base * (0.4 + 0.6 * active);
        edgeMat.opacity = (0.18 + 0.5 * active) * forgeVisual;
      }
    }

    /* ---------- DELIVERY (station 4, P .55→.75) -------------------------
       The gallery lane. `world` translates forward as we progress; we position
       the delivery group so the three screens sweep through the camera framing
       one-by-one across the delivery range, each pulsing emerald as it passes
       (timed to its DOM work-card entering the viewport). ------------------- */
    const delLocal = clamp01(
      (P - ST.forgeEnd) / (ST.deliveryEnd - ST.forgeEnd)
    );
    // Fade the gallery out quickly right after its own range so it clears the
    // pricing text in the CALM station (contrast must stay low behind pricing).
    delivery.visible = P > ST.forgeEnd - 0.04 && P < ST.deliveryEnd + 0.05;
    if (delivery.visible) {
      const delIn = smoothstep(ST.forgeEnd - 0.02, ST.deliveryEnd - 0.06, P);
      const delOut = smoothstep(ST.deliveryEnd - 0.02, ST.deliveryEnd + 0.04, P);
      const delVisual = delIn * (1 - delOut);
      // Counter the world translation, then sweep the lane forward so screen i
      // is centered (absolute Z ≈ -8, ahead of the camera) at delLocal≈(i+.5)/3.
      const sweep = delLocal * (deliveryScreens.length * LANE_SPACING);
      delivery.position.z = -world.position.z - 8 + sweep;
      deliveryScreens.forEach((mesh, i) => {
        const { mat, frameEdges } = mesh.userData;
        const t0 = i / 3, t1 = (i + 1) / 3;
        const pass = window01(t0 - 0.08, t1 + 0.08, delLocal);
        mat.opacity = (0.42 + 0.54 * pass) * delVisual;
        frameEdges.material.opacity = (0.18 + 0.55 * pass) * delVisual;
      });
    }

    /* ---------- CAMERA drifts (lateral/vertical accents on the path) ----- */
    // Lateral camera drift across the forge thirds (left → center → right).
    const forgeLateralLocal = clamp01((P - ST.recessEnd) / (ST.forgeEnd - ST.recessEnd));
    const forgeLateral =
      forge.visible ? lerp(-1.4, 1.4, smoothstep(0.1, 0.9, forgeLateralLocal)) : 0;

    // Gallery: gentle side-to-side list as the camera passes each screen.
    const galleryLateral =
      delivery.visible ? Math.sin(delLocal * Math.PI * 1.5) * 0.7 : 0;

    // Compose camera position. Camera stays near origin; small moves sell it.
    const camX = lerp(forgeLateral, galleryLateral,
      smoothstep(ST.forgeEnd - 0.03, ST.forgeEnd + 0.03, P));
    // Dolly-in over hero exactly as before (6.2 → 5.4), then hold ~5.4.
    const heroDolly = 6.2 - smoothstep(0, 1, heroP) * 0.8;
    // Slight pull-back in calm to reveal the re-approaching monolith.
    const calmPull = smoothstep(ST.deliveryEnd, ST.calmEnd, P) *
      (1 - smoothstep(ST.calmEnd, 1.0, P)) * 1.4;
    camPos.set(camX, 0, heroDolly + calmPull);
    camera.position.copy(camPos);

    // Look target: straight ahead into the world, following the lateral drift
    // so the forge clusters / gallery screens frame nicely, and recentering on
    // return (approach→1) so the monolith sits dead-center behind the CTA.
    camLook.set(camX * (1 - approach) * 0.3, 0, camera.position.z - 8);
    camera.lookAt(camLook);
  }

  /* ---- Reduced motion: ONE static frame, station 1 framing, no binding -- */
  if (reducedMotion) {
    monolith.rotation.y = THREE.MathUtils.degToRad(25);
    monolith.rotation.x = 0;
    camera.position.set(0, 0, 5.8);
    camera.lookAt(0, 0, 0);
    forge.visible = false;
    delivery.visible = false;
  }

  /* ---- Render one frame (called from main.js's shared rAF) ------------- */
  function render(nowSec) {
    if (contextLost) return;

    // Monolith screen redraw — throttled to every 3rd frame, and only while
    // the monolith is actually on-screen (station 1/2/6).
    if (!reducedMotion) {
      if (monolith.visible && frame % 3 === 0) drawScreen(nowSec);
    } else if (frame === 0) {
      drawScreen(0);
    }

    if (!reducedMotion) {
      // Dust drift (camera-space), wrap around a tall column.
      const pos = dustGeo.attributes.position.array;
      for (let i = 0; i < DUST; i++) {
        pos[i * 3 + 1] += speeds[i] * 0.016;
        if (pos[i * 3 + 1] > 6) pos[i * 3 + 1] = -6;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // Forge windows idle drift (sin bob) — only while forge is visible.
      if (forge.visible) {
        for (const w of forgeWindows) {
          const { baseY, phase } = w.userData;
          w.position.y = baseY + Math.sin(nowSec * 0.5 + phase) * 0.12;
        }
      }

      // Return-station rim pulse: slow emerald flare behind the CTA.
      if (P > ST.calmEnd) {
        const pulse = 0.5 + 0.5 * Math.sin(nowSec * 1.1);
        key.intensity = lerp(90, 150, smoothstep(ST.calmEnd, 1.0, P)) *
          (0.7 + 0.3 * pulse);
      }
    }

    renderer.render(scene, camera);
    frame++;
  }

  // Prime one frame so the canvas is never empty on crossfade-in.
  render(0);

  return {
    /** Feed global + hero-local progress. No-op in reduced motion. */
    setProgress(pGlobal, pHero) {
      if (!reducedMotion) applyProgress(pGlobal, pHero == null ? pGlobal : pHero);
    },
    /** Render one frame; nowSec = performance.now()/1000. */
    render,
    /** Keep canvas backing store in sync with layout. */
    resize,
    reducedMotion,
    /** Read-only perf/telemetry snapshot (draw calls, triangles, station). */
    debug() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        P, heroP,
        monolith: monolith.visible,
        forge: forge.visible,
        delivery: delivery.visible,
      };
    },
    dispose() {
      window.removeEventListener('resize', resize);
      slabGeo.dispose(); screenGeo.dispose(); dustGeo.dispose();
      forgeGeo.dispose(); edgeGeo.dispose(); screenPlaneGeo.dispose();
      slabMat.dispose(); screenMat.dispose(); dustMat.dispose();
      screenTex.dispose();
      forgeTexA.dispose(); forgeTexB.dispose(); forgeTexC.dispose();
      forgeWindows.forEach((w) => { w.userData.mat.dispose(); w.userData.edgeMat.dispose(); });
      deliveryScreens.forEach((m) => {
        m.userData.mat.dispose();
        if (m.userData.mat.map) m.userData.mat.map.dispose();
      });
      renderer.dispose();
    },
  };
}
