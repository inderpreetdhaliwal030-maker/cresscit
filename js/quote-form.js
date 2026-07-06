/* ==========================================================================
   CRESSCIT — Quote Form (v2 — direct submit)
   Dynamically imported by js/main.js on first [data-quote-trigger] click
   (zero bytes in the initial load). A short intake overlay that submits the
   lead directly from the page via Web3Forms (POST JSON); on failure the form
   stays intact and offers the v1 mailto path as a fallback.

   Mirrors the Preview Machine dialog contract, including both lessons:
   - keydown handler lives on `document` while open (Esc from <body> works);
   - overlay root reuses the .pm-overlay shell, inheriting the
     `.pm-overlay[hidden] { display:none !important }` guarantee.

   Safety: user input is read via .value only and never interpolated into
   HTML strings. Answers go only where the visitor sends them — the Web3Forms
   endpoint on submit, or their own mail app via the fallback.

   Copy: all strings verbatim from content/copy.md "## QUOTE FORM".
   Styles: css/main.css under "@component: quote-form" (reuses .pm- shell).
   ========================================================================== */

import { CONTACT_EMAIL, WEB3FORMS_KEY } from './site-config.js';

const ENDPOINT = 'https://api.web3forms.com/submit';
const TIMEOUT_MS = 10000;

/* ---- Copy (verbatim) ----------------------------------------------------- */
const COPY = {
  headline: "Let's price your site.",
  subline: "A few quick questions — we'll come back with one flat price.",
  nameLabel: 'Your business name',
  namePlaceholder: 'e.g. Ember & Oak',
  pickerLabel: 'What do you do?',
  websiteLabel: 'Do you have a website today?',
  websiteOptions: ['Yes, but it needs work', 'No, starting fresh'],
  needsLabel: 'What do you need?',
  needsOptions: [
    'A brand-new website',
    'A redesign of my current site',
    'Online booking or reservations',
    'A menu, services, or price list',
    'Contact or quote forms',
    'An online store',
    "Not sure yet — that's fine",
  ],
  notesLabel: 'Anything else we should know?',
  notesPlaceholder: 'Deadlines, sites you like, budget worries — anything helps. Optional.',
  emailLabel: 'Your email',
  emailPlaceholder: 'you@yourbusiness.com',
  emailWhy: 'So we can send your quote.',
  emailInvalid: 'We just need an email we can reply to.',
  phoneLabel: 'Phone (optional)',
  submit: 'Send My Request',
  helper: "Hit send and it comes straight to us — we'll reply with one flat quote.",
  sendingLabel: 'Sending…',
  sentHeadline: 'Got it.',
  sentLine: "Your request is with us — we'll reply with your flat quote.",
  doneLabel: 'Done',
  errorLine: "That didn't go through — our end, not yours.",
  emailFallbackLabel: 'Send it by email',
  closeLabel: 'Close quote form',
  subjectTemplate: 'Website quote request — {{NAME}}',
};

/* Same four verticals as the Preview Machine (per copy.md). */
const VERTICAL_LABELS = ['Restaurant', 'Trades & Contracting', 'Clinic', 'Something Else'];

const NOT_ANSWERED = '(not answered)';
const NOT_SURE_INDEX = 6;   // "Not sure yet — that's fine" — mutually exclusive
const FROM_NAME_FALLBACK = 'Cresscit quote form'; // from_name when no business name

/* ---- Tiny DOM helper (no innerHTML anywhere near user input) -------------- */
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

/* ---- Module state ---------------------------------------------------------- */
let overlay = null;
let refs = {};
let opts = {};
let openerEl = null;
let isOpen = false;
let keyHandler = null;
let inFlight = false;
let controller = null;      // AbortController for the in-flight request
let showingSent = false;    // success shown → next open resets to a fresh form

/* ==========================================================================
   Overlay construction (once; reused across opens)
   ========================================================================== */
function chipInput(type, name, value, labelText) {
  const chip = el('label', 'pm-chip');
  const input = el('input');
  input.type = type;
  input.name = name;
  input.value = value;
  input.className = 'pm-chip__radio';   // shared chip-input styling
  chip.append(input, el('span', 'pm-chip__text', labelText));
  return { chip, input };
}

function buildOverlay() {
  overlay = el('div', 'pm-overlay qf-overlay');   // inherits [hidden] guarantee
  overlay.hidden = true;

  const backdrop = el('div', 'pm-backdrop');
  backdrop.addEventListener('click', close);

  const panel = el('div', 'pm-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'qf-headline');

  const closeBtn = el('button', 'pm-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', COPY.closeLabel);
  closeBtn.append(el('span', 'pm-close__x', '×'));
  closeBtn.addEventListener('click', close);

  const headline = el('h2', 'pm-headline', COPY.headline);
  headline.id = 'qf-headline';
  const subline = el('p', 'pm-subline', COPY.subline);

  /* Visually-hidden live announcer for sent/error state changes. */
  const announcer = el('p', 'visually-hidden');
  announcer.setAttribute('aria-live', 'polite');

  const form = el('form', 'pm-form qf-form');
  form.noValidate = true;

  /* Business name */
  const nameLabel = el('label', 'pm-label', COPY.nameLabel);
  nameLabel.htmlFor = 'qf-name';
  const nameInput = el('input', 'pm-input');
  nameInput.id = 'qf-name';
  nameInput.type = 'text';
  nameInput.name = 'qf-business-name';
  nameInput.placeholder = COPY.namePlaceholder;
  nameInput.maxLength = 60;
  nameInput.autocomplete = 'organization';

  /* Vertical (radio chips; nothing pre-checked) */
  const vertSet = el('fieldset', 'pm-verticals');
  vertSet.append(el('legend', 'pm-label', COPY.pickerLabel));
  const vertRow = el('div', 'pm-chiprow');
  VERTICAL_LABELS.forEach((label) => {
    vertRow.append(chipInput('radio', 'qf-vertical', label, label).chip);
  });
  vertSet.append(vertRow);

  /* Has-website (radio chips) */
  const webSet = el('fieldset', 'pm-verticals');
  webSet.append(el('legend', 'pm-label', COPY.websiteLabel));
  const webRow = el('div', 'pm-chiprow');
  COPY.websiteOptions.forEach((label) => {
    webRow.append(chipInput('radio', 'qf-haswebsite', label, label).chip);
  });
  webSet.append(webRow);

  /* Needs (checkbox chips with "not sure yet" mutual exclusion) */
  const needsSet = el('fieldset', 'pm-verticals');
  needsSet.append(el('legend', 'pm-label', COPY.needsLabel));
  const needsRow = el('div', 'pm-chiprow');
  const needsInputs = [];
  COPY.needsOptions.forEach((label, i) => {
    const { chip, input } = chipInput('checkbox', 'qf-needs', label, label);
    input.addEventListener('change', () => {
      if (!input.checked) return;
      if (i === NOT_SURE_INDEX) {
        needsInputs.forEach((other, j) => { if (j !== NOT_SURE_INDEX) other.checked = false; });
      } else {
        needsInputs[NOT_SURE_INDEX].checked = false;
      }
    });
    needsInputs.push(input);
    needsRow.append(chip);
  });
  needsSet.append(needsRow);

  /* Contact block — email (the ONLY required field) + optional phone */
  const emailLabel = el('label', 'pm-label', COPY.emailLabel);
  emailLabel.htmlFor = 'qf-email';
  const emailWhy = el('p', 'qf-why', COPY.emailWhy);
  emailWhy.id = 'qf-email-why';
  const emailInput = el('input', 'pm-input');
  emailInput.id = 'qf-email';
  emailInput.type = 'email';
  emailInput.name = 'qf-email';
  emailInput.placeholder = COPY.emailPlaceholder;
  emailInput.autocomplete = 'email';
  emailInput.required = true;
  emailInput.setAttribute('aria-describedby', 'qf-email-why qf-email-msg');
  const emailMsg = el('p', 'qf-invalid');   // inline validation message
  emailMsg.id = 'qf-email-msg';
  emailMsg.hidden = true;
  emailInput.addEventListener('blur', () => {
    // Friendly: only flag on blur once the visitor typed something (or a
    // previous submit already surfaced the message).
    if (emailInput.value.trim() !== '' || !emailMsg.hidden) validateEmail(false);
  });
  emailInput.addEventListener('input', () => {
    if (!emailMsg.hidden && emailValid()) setEmailError(false);
  });

  const phoneLabel = el('label', 'pm-label', COPY.phoneLabel);
  phoneLabel.htmlFor = 'qf-phone';
  const phoneInput = el('input', 'pm-input');
  phoneInput.id = 'qf-phone';
  phoneInput.type = 'tel';
  phoneInput.name = 'qf-phone';
  phoneInput.autocomplete = 'tel';

  /* Honeypot — visually hidden, out of tab order, ignored by AT.
     Humans never see or fill it; Web3Forms drops submissions where it's set. */
  const hpWrap = el('div', 'qf-hp');
  hpWrap.setAttribute('aria-hidden', 'true');
  const hpInput = el('input');
  hpInput.type = 'text';
  hpInput.name = 'botcheck';
  hpInput.tabIndex = -1;
  hpInput.autocomplete = 'off';
  hpWrap.append(hpInput);

  /* Notes */
  const notesLabel = el('label', 'pm-label', COPY.notesLabel);
  notesLabel.htmlFor = 'qf-notes';
  const notes = el('textarea', 'pm-input qf-notes');
  notes.id = 'qf-notes';
  notes.name = 'qf-notes';
  notes.rows = 3;
  notes.placeholder = COPY.notesPlaceholder;

  /* Submit + helper + error fallback row */
  const submitBtn = el('button', 'btn btn--primary qf-submit', COPY.submit);
  submitBtn.type = 'submit';
  const helper = el('p', 'qf-helper', COPY.helper);
  const errorRow = el('div', 'qf-errorrow');
  errorRow.hidden = true;
  const errorLine = el('p', 'qf-errorline', COPY.errorLine);
  const mailtoBtn = el('button', 'pm-try qf-mailto', COPY.emailFallbackLabel);
  mailtoBtn.type = 'button';
  mailtoBtn.addEventListener('click', sendByEmail);
  errorRow.append(errorLine, mailtoBtn);

  form.append(
    nameLabel, nameInput,
    vertSet, webSet, needsSet,
    emailLabel, emailWhy, emailInput, emailMsg,
    phoneLabel, phoneInput,
    hpWrap,
    notesLabel, notes,
    submitBtn, helper, errorRow
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuote();
  });

  /* Sent state — replaces the form after a successful delivery */
  const sent = el('div', 'qf-sent');
  sent.hidden = true;
  const sentHead = el('p', 'qf-sent__head', COPY.sentHeadline);
  const sentLine = el('p', 'qf-sent__line', COPY.sentLine);
  const doneBtn = el('button', 'btn btn--primary', COPY.doneLabel);
  doneBtn.type = 'button';
  doneBtn.addEventListener('click', close);   // standard close path
  sent.append(sentHead, sentLine, doneBtn);

  panel.append(closeBtn, headline, subline, announcer, form, sent);
  overlay.append(backdrop, panel);

  /* Keyboard: attached to document while open — an overlay-scoped listener
     misses Esc/Tab when focus sits on <body>. */
  keyHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [...panel.querySelectorAll(
      'button, [href], input, select, textarea'
    )].filter((n) => !n.disabled && n.offsetParent !== null && n.tabIndex !== -1);
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
  refs = {
    panel, form, nameInput, emailInput, emailMsg, phoneInput, hpInput,
    submitBtn, helper, errorRow, sent, doneBtn, announcer,
  };
}

/* ==========================================================================
   Email validation (the only required field)
   ========================================================================== */
function emailValid() {
  const v = refs.emailInput.value.trim();
  return v !== '' && refs.emailInput.validity.valid;
}

function setEmailError(on) {
  refs.emailMsg.hidden = !on;
  refs.emailMsg.textContent = on ? COPY.emailInvalid : '';
  refs.emailInput.setAttribute('aria-invalid', on ? 'true' : 'false');
  refs.emailInput.classList.toggle('qf-input--invalid', on);
}

function validateEmail(focusOnFail) {
  const ok = emailValid();
  setEmailError(!ok);
  if (!ok && focusOnFail) refs.emailInput.focus();
  return ok;
}

/* ==========================================================================
   Answers → plain-text message (same compiled body as v1, plus Phone)
   ========================================================================== */
function readAnswers() {
  const name = refs.nameInput.value.trim();
  const vertical = overlay.querySelector('input[name="qf-vertical"]:checked');
  const hasSite = overlay.querySelector('input[name="qf-haswebsite"]:checked');
  const needs = [...overlay.querySelectorAll('input[name="qf-needs"]:checked')]
    .map((n) => n.value);
  const notes = overlay.querySelector('#qf-notes').value.trim();
  const email = refs.emailInput.value.trim();
  const phone = refs.phoneInput.value.trim();
  return {
    name,
    vertical: vertical ? vertical.value : '',
    hasSite: hasSite ? hasSite.value : '',
    needs, notes, email, phone,
  };
}

function compileMessage(extraLines = []) {
  const a = readAnswers();
  const subject = a.name
    ? COPY.subjectTemplate.replace('{{NAME}}', a.name)
    : COPY.subjectTemplate.replace(' — {{NAME}}', '');   // no name segment
  const lines = [
    `Business: ${a.name || NOT_ANSWERED}`,
    `What they do: ${a.vertical || NOT_ANSWERED}`,
    `Has a site today: ${a.hasSite || NOT_ANSWERED}`,
    `Needs: ${a.needs.length ? a.needs.join(', ') : NOT_ANSWERED}`,
    `Phone: ${a.phone || NOT_ANSWERED}`,
    `Notes: ${a.notes || NOT_ANSWERED}`,
    ...extraLines,
    '',
    "— sent from cresscit's quote form",
  ];
  return { answers: a, subject, body: lines.join('\r\n') };
}

/* ==========================================================================
   Submit — POST to Web3Forms with an abortable ~10s timeout
   ========================================================================== */
function setInFlight(on) {
  inFlight = on;
  refs.submitBtn.disabled = on;
  refs.submitBtn.textContent = on ? COPY.sendingLabel : COPY.submit;
}

function showSentState() {
  showingSent = true;
  refs.form.hidden = true;
  refs.sent.hidden = false;
  refs.announcer.textContent = `${COPY.sentHeadline} ${COPY.sentLine}`;
  refs.doneBtn.focus();
}

function showErrorState() {
  refs.errorRow.hidden = false;
  refs.announcer.textContent = COPY.errorLine;
}

async function submitQuote() {
  if (inFlight) return;                       // double-submit guard
  if (!validateEmail(true)) return;           // no request without an email

  refs.errorRow.hidden = true;
  const { answers, subject, body } = compileMessage();
  setInFlight(true);

  controller = new AbortController();
  const timeout = setTimeout(() => { if (controller) controller.abort(); }, TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject,
        from_name: answers.name || FROM_NAME_FALLBACK,
        email: answers.email,                 // becomes reply-to at Web3Forms
        botcheck: refs.hpInput.value,         // honeypot — empty for humans
        message: body,
      }),
    });
    const data = await res.json();
    if (!data || data.success !== true) throw new Error('non-success response');

    clearTimeout(timeout);
    controller = null;
    setInFlight(false);
    if (isOpen) showSentState();              // closed mid-flight → stay quiet
  } catch (err) {
    // Network error, timeout-abort, close-abort, or non-success response.
    clearTimeout(timeout);
    controller = null;
    setInFlight(false);
    // Closed during flight (Esc/backdrop/X aborted us): stay silent — the
    // form, with every value intact, is simply there on the next open.
    if (isOpen) showErrorState();
  }
}

/* Mailto fallback — the v1 path, plus a "Reply to:" line in the body (mailto
   can't set a real reply-to header). */
function sendByEmail() {
  const email = refs.emailInput.value.trim();
  const { subject, body } = compileMessage([`Reply to: ${email || NOT_ANSWERED}`]);
  const href =
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}

/* ==========================================================================
   Open / close
   ========================================================================== */
export function openQuoteForm(options = {}) {
  opts = options;
  if (!overlay) buildOverlay();
  if (isOpen) return;
  isOpen = true;

  openerEl = options.trigger || document.activeElement;

  // A previous SUCCESS means a fresh form this time. After a failure or an
  // abandoned attempt, everything the visitor typed is still there.
  if (showingSent) {
    showingSent = false;
    refs.form.reset();
    setEmailError(false);
  }
  refs.sent.hidden = true;
  refs.form.hidden = false;
  refs.errorRow.hidden = true;
  refs.announcer.textContent = '';
  setInFlight(false);

  overlay.hidden = false;
  document.addEventListener('keydown', keyHandler);
  document.documentElement.classList.add('pm-lock');
  if (typeof opts.lockScroll === 'function') opts.lockScroll();
  refs.nameInput.focus();
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  // Abort any in-flight request — its catch sees isOpen=false and stays quiet.
  if (controller) { controller.abort(); controller = null; }
  overlay.hidden = true;
  document.removeEventListener('keydown', keyHandler);
  document.documentElement.classList.remove('pm-lock');
  if (typeof opts.unlockScroll === 'function') opts.unlockScroll();
  if (openerEl && typeof openerEl.focus === 'function') openerEl.focus();
}
