/* ==========================================================================
   CRESSCIT — Preview Machine
   Dynamically imported by js/main.js on first trigger click (zero bytes in
   the initial load). Opens an a11y-correct dialog: business-name input +
   vertical picker → a mock browser frame where a miniature themed homepage
   for THEIR business assembles section by section (the FORGE made personal)
   → honest bridge line + prefilled mailto CTA.

   Safety: user input is rendered with textContent ONLY — never interpolated
   into HTML strings. Nothing is stored or sent anywhere; the name appears
   only in the visitor's own mailto handoff.

   Copy: all strings verbatim from content/copy.md "## PREVIEW MACHINE".
   Styles: css/main.css under "@component: preview-machine".
   ========================================================================== */

/* ---- Copy (verbatim) ----------------------------------------------------- */
const COPY = {
  headline: 'See your site take shape.',
  subline: "Type your business name, pick your trade — we'll handle the rest.",
  nameLabel: 'Your business name',
  namePlaceholder: 'e.g. Ember & Oak',
  pickerLabel: 'What do you do?',
  status: 'Building your homepage, section by section…',
  postReveal: 'That took ten seconds — your real preview is hand-built by us, free, and in your inbox within days.',
  cta: 'Get My Hand-Built Preview',
  microline: 'Free. No contract. No pressure.',
  closeLabel: 'Close preview',
  /* Not in the copy deck (documented deviations): the build submit button and
     device-toggle labels come from the spec's own wording; the mailto body is
     spec-required ("one-line prefilled body") but has no deck string. */
  buildButton: 'Build my homepage',
  deviceDesktop: 'Desktop',
  devicePhone: 'Phone',
  tryAnother: 'Try another',
};

const VERTICALS = [
  {
    id: 'restaurant',
    label: 'Restaurant',
    fallback: 'Your Restaurant',
    headlineSuffix: ' — worth the reservation',
    sub: 'Fresh menu. Easy booking. Open tonight.',
    sections: ['Menu', 'Reservations', 'Hours'],
  },
  {
    id: 'trades',
    label: 'Trades & Contracting',
    fallback: 'Your Company',
    headlineSuffix: ' — built to last',
    sub: 'Quality work. Straight quotes. On time.',
    sections: ['Our Work', 'Get a Quote', 'Service Area'],
  },
  {
    id: 'clinic',
    label: 'Clinic',
    fallback: 'Your Clinic',
    headlineSuffix: ' — care without the wait',
    sub: 'Book online. Be seen sooner.',
    sections: ['Services', 'Book a Visit', 'Our Team'],
  },
  {
    id: 'other',
    label: 'Something Else',
    fallback: 'Your Business',
    headlineSuffix: ' — open and easy to find',
    sub: 'What you do, done well, one click away.',
    sections: ['About', 'Services', 'Contact'],
  },
];

const MAILTO_ADDR = 'hello@cresscit.com'; // documented placeholder (README)

/* ---- Tiny DOM helpers (no innerHTML anywhere near user input) ------------ */
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** name lowercased, non-alphanumerics → single dashes, trimmed. */
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ---- Module state --------------------------------------------------------- */
let overlay = null;
let refs = {};              // node references, filled by buildOverlay()
let opts = {};              // per-open options from main.js
let openerEl = null;        // focus restore target
let timers = [];
let isOpen = false;
let keyHandler = null;      // document-level while open (Esc must work from <body>)

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/* ==========================================================================
   Overlay construction (once; reused across opens)
   ========================================================================== */
function buildOverlay() {
  overlay = el('div', 'pm-overlay');
  overlay.hidden = true;

  const backdrop = el('div', 'pm-backdrop');
  backdrop.addEventListener('click', close);

  const panel = el('div', 'pm-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'pm-headline');

  const closeBtn = el('button', 'pm-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', COPY.closeLabel);
  closeBtn.append(el('span', 'pm-close__x', '×'));
  closeBtn.addEventListener('click', close);

  const headline = el('h2', 'pm-headline', COPY.headline);
  headline.id = 'pm-headline';
  const subline = el('p', 'pm-subline', COPY.subline);

  /* ---- Form: name + vertical radiogroup + build button ---- */
  const form = el('form', 'pm-form');
  form.noValidate = true;

  const nameLabel = el('label', 'pm-label', COPY.nameLabel);
  nameLabel.htmlFor = 'pm-name';
  const nameInput = el('input', 'pm-input');
  nameInput.id = 'pm-name';
  nameInput.type = 'text';
  nameInput.name = 'business-name';
  nameInput.placeholder = COPY.namePlaceholder;
  nameInput.maxLength = 60;
  nameInput.autocomplete = 'organization';

  const fieldset = el('fieldset', 'pm-verticals');
  fieldset.append(el('legend', 'pm-label', COPY.pickerLabel));
  const chipRow = el('div', 'pm-chiprow');
  VERTICALS.forEach((v, i) => {
    const chip = el('label', 'pm-chip');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'pm-vertical';
    radio.value = v.id;
    radio.className = 'pm-chip__radio';
    if (i === 0) radio.checked = true;
    chip.append(radio, el('span', 'pm-chip__text', v.label));
    chipRow.append(chip);
  });
  fieldset.append(chipRow);

  const buildBtn = el('button', 'btn btn--primary pm-build', COPY.buildButton);
  buildBtn.type = 'submit';

  form.append(nameLabel, nameInput, fieldset, buildBtn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    startBuild();
  });

  /* ---- Stage: status line, device bar, browser frame, post-reveal ---- */
  const stage = el('div', 'pm-stage');
  stage.hidden = true;

  const status = el('p', 'pm-status');
  status.setAttribute('aria-live', 'polite');

  const deviceBar = el('div', 'pm-devicebar');
  deviceBar.hidden = true;
  const deskBtn = el('button', 'pm-device is-on', COPY.deviceDesktop);
  deskBtn.type = 'button';
  deskBtn.setAttribute('aria-pressed', 'true');
  const phoneBtn = el('button', 'pm-device', COPY.devicePhone);
  phoneBtn.type = 'button';
  phoneBtn.setAttribute('aria-pressed', 'false');
  const setDevice = (phone) => {
    refs.frame.classList.toggle('pm-frame--phone', phone);
    deskBtn.classList.toggle('is-on', !phone);
    phoneBtn.classList.toggle('is-on', phone);
    deskBtn.setAttribute('aria-pressed', String(!phone));
    phoneBtn.setAttribute('aria-pressed', String(phone));
  };
  deskBtn.addEventListener('click', () => setDevice(false));
  phoneBtn.addEventListener('click', () => setDevice(true));
  deviceBar.append(deskBtn, phoneBtn);

  const frame = el('div', 'pm-frame');
  frame.hidden = true;
  const chrome = el('div', 'pm-chrome');
  const dots = el('span', 'pm-dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(el('i'), el('i'), el('i'));
  const url = el('span', 'pm-url');
  chrome.append(dots, url);
  const site = el('div', 'pm-site');
  frame.append(chrome, site);

  const after = el('div', 'pm-after');
  after.hidden = true;
  const postLine = el('p', 'pm-postline', COPY.postReveal);
  const ctaBtn = el('a', 'btn btn--primary pm-cta', COPY.cta);
  const micro = el('p', 'pm-micro', COPY.microline);
  const tryBtn = el('button', 'pm-try', COPY.tryAnother);
  tryBtn.type = 'button';
  tryBtn.addEventListener('click', resetToForm);
  after.append(postLine, ctaBtn, micro, tryBtn);

  stage.append(status, deviceBar, frame, after);
  panel.append(closeBtn, headline, subline, form, stage);
  overlay.append(backdrop, panel);

  /* ---- Keyboard: Esc closes; Tab cycles within the panel.
     Attached to document while open — an overlay-scoped listener misses
     Esc/Tab when focus sits on <body> (e.g. after clicking panel dead space). */
  keyHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [...panel.querySelectorAll(
      'button, [href], input, select, textarea'
    )].filter((n) => !n.disabled && n.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  document.body.append(overlay);
  refs = { panel, form, nameInput, stage, status, deviceBar, frame, url, site, after, ctaBtn, setDevice };
}

/* ==========================================================================
   Mini-site builders — skeleton shapes + the short copy strings, themed via
   scoped custom properties on .pm-site[data-vertical] (see main.css).
   ========================================================================== */
function bar(cls, width) {
  const b = el('i', 'pm-bar' + (cls ? ' ' + cls : ''));
  if (width) b.style.width = width;
  b.setAttribute('aria-hidden', 'true');
  return b;
}

function buildMiniNav(name) {
  const nav = el('div', 'pm-piece pm-mini-nav');
  nav.append(el('strong', 'pm-mini-brand', name));
  const links = el('span', 'pm-mini-links');
  links.setAttribute('aria-hidden', 'true');
  links.append(bar('', '26px'), bar('', '32px'), bar('', '22px'));
  const pill = el('span', 'pm-mini-navbtn');
  pill.setAttribute('aria-hidden', 'true');
  nav.append(links, pill);
  return nav;
}

function buildMiniHero(name, v) {
  const hero = el('div', 'pm-piece pm-mini-hero');
  const h = el('div', 'pm-mini-headline');
  h.append(el('span', 'pm-mini-name', name), document.createTextNode(v.headlineSuffix));
  hero.append(h, el('p', 'pm-mini-sub', v.sub), el('span', 'pm-mini-cta'));
  hero.lastChild.setAttribute('aria-hidden', 'true');
  return hero;
}

/** One themed content block per section label, per vertical. */
function buildSection(v, label, i) {
  const s = el('div', `pm-piece pm-mini-section pm-sec-${v.id}-${i}`);
  s.append(el('h4', 'pm-mini-label', label));
  const body = el('div', 'pm-mini-body');
  body.setAttribute('aria-hidden', 'true');

  if (v.id === 'restaurant') {
    if (i === 0) { // Menu — dish rows with dotted leaders + prices
      for (let r = 0; r < 3; r++) {
        const row = el('span', 'pm-menurow');
        row.append(bar('', `${46 - r * 8}%`), el('i', 'pm-leader'), bar('pm-bar--accent', '18px'));
        body.append(row);
      }
    } else if (i === 1) { // Reservations — date/time slots + button
      const slots = el('span', 'pm-slotrow');
      slots.append(bar('pm-slot'), bar('pm-slot'), bar('pm-slot pm-slot--on'));
      body.append(slots, el('span', 'pm-mini-btn'));
    } else { // Hours — day/time rows
      for (let r = 0; r < 2; r++) {
        const row = el('span', 'pm-menurow');
        row.append(bar('', '30%'), bar('', '24%'));
        body.append(row);
      }
    }
  } else if (v.id === 'trades') {
    if (i === 0) { // Our Work — photo grid
      const grid = el('span', 'pm-photogrid');
      for (let r = 0; r < 6; r++) grid.append(el('i', 'pm-photo'));
      body.append(grid);
    } else if (i === 1) { // Get a Quote — field + button
      const q = el('span', 'pm-quoterow');
      q.append(bar('pm-field', '58%'), el('span', 'pm-mini-btn'));
      body.append(q);
    } else { // Service Area — map band + row
      body.append(el('i', 'pm-map'), bar('', '52%'));
    }
  } else if (v.id === 'clinic') {
    if (i === 0) { // Services — soft rows
      for (let r = 0; r < 3; r++) {
        const row = el('span', 'pm-servicerow');
        row.append(el('i', 'pm-dot'), bar('', `${58 - r * 10}%`));
        body.append(row);
      }
    } else if (i === 1) { // Book a Visit — booking pill
      body.append(el('span', 'pm-bookpill'));
    } else { // Our Team — avatar circles
      const team = el('span', 'pm-teamrow');
      for (let r = 0; r < 3; r++) team.append(el('i', 'pm-avatar'));
      body.append(team);
    }
  } else { // other
    if (i === 0) { // About — text lines
      body.append(bar('', '86%'), bar('', '70%'), bar('', '78%'));
    } else if (i === 1) { // Services — three cards
      const cards = el('span', 'pm-cardrow');
      for (let r = 0; r < 3; r++) {
        const c = el('i', 'pm-minicard');
        cards.append(c);
      }
      body.append(cards);
    } else { // Contact — button + line
      body.append(el('span', 'pm-mini-btn'), bar('', '44%'));
    }
  }
  s.append(body);
  return s;
}

function buildMiniFooter(name) {
  const f = el('div', 'pm-piece pm-mini-footer');
  f.append(el('span', 'pm-mini-brand pm-mini-brand--sm', name));
  const rows = el('span', 'pm-mini-links');
  rows.setAttribute('aria-hidden', 'true');
  rows.append(bar('', '30px'), bar('', '24px'));
  f.append(rows);
  return f;
}

/* ==========================================================================
   Build sequence — the show
   ========================================================================== */
function currentVertical() {
  const checked = refs.panel.querySelector('input[name="pm-vertical"]:checked');
  return VERTICALS.find((v) => v.id === (checked && checked.value)) || VERTICALS[0];
}

function startBuild() {
  clearTimers();
  const v = currentVertical();
  const raw = refs.nameInput.value.trim();
  const name = raw || v.fallback;               // empty ⇒ copy's fallback
  const slug = slugify(name) || slugify(v.fallback); // emoji-only ⇒ fallback slug

  // Swap form → stage
  refs.form.hidden = true;
  refs.stage.hidden = false;
  refs.after.hidden = true;
  refs.deviceBar.hidden = true;
  refs.status.textContent = COPY.status;
  refs.url.textContent = `${slug}.com`;
  refs.setDevice(false);

  // Fresh mini-site
  refs.site.textContent = '';
  refs.site.dataset.vertical = v.id;
  const pieces = [
    buildMiniNav(name),
    buildMiniHero(name, v),
    ...v.sections.map((label, i) => buildSection(v, label, i)),
    buildMiniFooter(name),
  ];
  pieces.forEach((p) => refs.site.append(p));
  refs.frame.hidden = false;

  // Mailto handoff — URL-encoded, name via the user's own mail client only.
  const subject = `Free preview request — ${name} (${v.label})`;
  const body = `Hi Cresscit — I'd like my free hand-built preview for ${name} (${v.label}).`;
  refs.ctaBtn.href =
    `mailto:${MAILTO_ADDR}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const finish = () => {
    refs.status.textContent = '';
    refs.deviceBar.hidden = false;
    refs.after.hidden = false;
  };

  if (opts.reducedMotion) {
    // Everything appears at once, no scanlines.
    pieces.forEach((p) => p.classList.add('pm-in'));
    finish();
    return;
  }

  // Stagger ~350ms apart (~2.2s total), each landing with a scanline sweep.
  pieces.forEach((p, i) => {
    timers.push(setTimeout(() => p.classList.add('pm-in'), 120 + i * 350));
  });
  timers.push(setTimeout(finish, 120 + pieces.length * 350 + 250));
}

function resetToForm() {
  clearTimers();
  refs.stage.hidden = true;
  refs.frame.hidden = true;
  refs.after.hidden = true;
  refs.deviceBar.hidden = true;
  refs.status.textContent = '';
  refs.form.hidden = false;        // previous name retained in the input
  refs.nameInput.focus();
}

/* ==========================================================================
   Open / close
   ========================================================================== */
export function openPreviewMachine(options = {}) {
  opts = options;
  if (!overlay) buildOverlay();
  if (isOpen) return;
  isOpen = true;

  openerEl = options.trigger || document.activeElement;
  resetToForm();
  overlay.hidden = false;
  document.addEventListener('keydown', keyHandler);
  document.documentElement.classList.add('pm-lock');
  if (typeof opts.lockScroll === 'function') opts.lockScroll();
  refs.nameInput.focus();
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  clearTimers();
  overlay.hidden = true;
  document.removeEventListener('keydown', keyHandler);
  document.documentElement.classList.remove('pm-lock');
  if (typeof opts.unlockScroll === 'function') opts.unlockScroll();
  if (openerEl && typeof openerEl.focus === 'function') openerEl.focus();
}
