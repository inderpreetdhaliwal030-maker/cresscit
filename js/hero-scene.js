/* ==========================================================================
   CRESSCIT — Hero scene (WebGL monolith)
   ES module. Draws a portrait obsidian slab whose front face is a live-updating
   emissive CanvasTexture rendering a mini website UI. Emerald key/rim lighting,
   drifting dust particles, CSS fake-bloom (done in main.css).

   Exposes a small controller so js/main.js can drive render + scroll from ONE
   shared rAF loop — this module never starts its own loop.

   Scroll contract (progress p, 0→1 over the pinned 300vh hero):
     rotation.y = p * 2π        (exactly one orbit)
     rotation.x = sin(p·2π)·0.05 (gentle wobble)
     camera z   = 6.2 → 5.4      (slow dolly-in)

   Fallback: if WebGL is unavailable, initHeroScene() returns null and main.js
   flags `.no-webgl` so the CSS monolith shows instead — layout never breaks.
   ========================================================================== */

import * as THREE from 'three';

const TAU = Math.PI * 2;

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
   Mini website UI — drawn to an offscreen 2D canvas, used as an emissive
   texture on the monolith's screen face. Redrawn every 3rd frame (throttled).
   Brand palette only. Includes a shimmer sweep + blinking cursor so it reads
   as a *live* site.
   ========================================================================== */
function createScreenTexture() {
  const W = 512, H = 792;                 // portrait, matches slab face ratio
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  const INK = '#0a0a0c', INK2 = '#101014', INK3 = '#16161c';
  const EMER = '#19e08c', EMER_DEEP = '#0b9159', CREAM = '#f4efe4', DIM = '#b9b4a6';

  const texture = new THREE.CanvasTexture(cvs);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(t) {
    // t = seconds since start (drives shimmer + cursor blink)
    ctx.clearRect(0, 0, W, H);

    // Backdrop
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
    // nav pill
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
      // card top accent
      ctx.fillStyle = i === 1 ? EMER : EMER_DEEP;
      roundRect(x + 16, cardY + 20, cardW - 32, 70, 8); ctx.fill();
      // card lines
      ctx.fillStyle = 'rgba(244,239,228,0.28)';
      roundRect(x + 16, cardY + 108, cardW - 40, 8, 4); ctx.fill();
      roundRect(x + 16, cardY + 128, cardW - 60, 8, 4); ctx.fill();
      roundRect(x + 16, cardY + 148, cardW - 30, 8, 4); ctx.fill();
      // card mini-pill
      ctx.fillStyle = EMER;
      roundRect(x + 16, cardY + cardH - 44, 64, 24, 12); ctx.fill();
    }

    // Shimmer sweep (diagonal highlight moving down the page)
    const sweep = ((t * 0.16) % 1.4) - 0.2;      // -0.2 → 1.2
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

  // Prime once so the texture is never blank on first frame.
  draw(0);
  return { texture, draw };
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

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  // --- Monolith group (slab + screen face) ---
  const group = new THREE.Group();
  scene.add(group);

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
  group.add(slab);

  // Screen face — plane 0.02 in front of the +Z face.
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
  group.add(screen);

  // --- Lights ---
  // Emerald key/rim behind-left
  const key = new THREE.SpotLight(0x19e08c, 90, 30, Math.PI / 4, 0.5, 1.2);
  key.position.set(-5, 3, -3);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);

  // Dim cool fill front-right
  const fill = new THREE.PointLight(0x2b4a66, 14, 40, 1.4);
  fill.position.set(4, -1, 5);
  scene.add(fill);

  // Faint top white
  const top = new THREE.DirectionalLight(0xffffff, 0.4);
  top.position.set(0, 6, 2);
  scene.add(top);

  scene.add(new THREE.AmbientLight(0x0a0a10, 0.6));

  // --- Emerald dust particles (~180, additive, slow drift) ---
  const DUST = 180;
  const positions = new Float32Array(DUST * 3);
  const speeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
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
  scene.add(dust);

  // --- Sizing ---
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

  // --- Context-loss handling (don't crash the page) ---
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    contextLost = true;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    resize();
  }, false);

  // --- Frame state ---
  let frame = 0;
  let progress = 0;

  function applyProgress(p) {
    progress = p;
    group.rotation.y = p * TAU;                 // exactly one orbit
    group.rotation.x = Math.sin(p * TAU) * 0.05; // gentle wobble
    camera.position.z = 6.2 - p * 0.8;           // 6.2 → 5.4 dolly
  }

  // Static frame for reduced motion: yaw ~25°, no scroll binding.
  if (reducedMotion) {
    group.rotation.y = THREE.MathUtils.degToRad(25);
    group.rotation.x = 0;
    camera.position.z = 5.8;
  }

  function render(nowSec) {
    if (contextLost) return;

    // Throttle the (expensive) screen redraw to every 3rd frame.
    if (!reducedMotion && frame % 3 === 0) {
      drawScreen(nowSec);
    } else if (reducedMotion && frame === 0) {
      drawScreen(0);
    }

    if (!reducedMotion) {
      // Drift dust upward, wrap around.
      const pos = dustGeo.attributes.position.array;
      for (let i = 0; i < DUST; i++) {
        pos[i * 3 + 1] += speeds[i] * 0.016;
        if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] = -4.5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    frame++;
  }

  // Render one frame immediately so the hero is never empty.
  render(0);

  return {
    /** Feed scroll progress (0→1). No-op in reduced motion. */
    setProgress(p) { if (!reducedMotion) applyProgress(p); },
    /** Render one frame; nowSec = seconds (performance.now()/1000). */
    render,
    /** Keep canvas backing store in sync with layout. */
    resize,
    reducedMotion,
    dispose() {
      window.removeEventListener('resize', resize);
      slabGeo.dispose(); screenGeo.dispose(); dustGeo.dispose();
      slabMat.dispose(); screenMat.dispose(); dustMat.dispose();
      screenTex.dispose();
      renderer.dispose();
    },
  };
}
