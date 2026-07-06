/* ==========================================================================
   CRESSCIT — Site configuration
   Single source of truth for values that must stay in sync site-wide.
   Imported by the lazy modules (preview-machine.js, quote-form.js).

   NOTE: the static no-JS fallback hrefs in index.html can't import this file —
   when CONTACT_EMAIL changes, update those hrefs too (see README).
   ========================================================================== */

export const CONTACT_EMAIL = 'cresscit@gmail.com';

/* Web3Forms access key for the quote form's direct submit.
   PUBLIC-BY-DESIGN: Web3Forms keys are made to be embedded in client-side
   code on static sites (the key only permits sending to the account's own
   inbox), so committing it here is correct — this is not a secret.
   'PENDING_KEY_FROM_FOUNDER' is a placeholder; swapping in the real key is
   the only change needed to go live. */
export const WEB3FORMS_KEY = 'bb8a1e0a-1196-4aea-aab3-89fda8791bd7';
