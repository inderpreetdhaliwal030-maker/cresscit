# QUOTE FORM — Build Spec v2 (direct submit)
The quote overlay now submits directly from the page and the lead is emailed to us —
no mail-app handoff. Copy from `content/copy.md` "## QUOTE FORM" — verbatim, including
the v2 pieces (contact fields, sending/sent states, error fallback).

## Delivery service
Web3Forms (built for static sites). POST `https://api.web3forms.com/submit` with JSON:
`access_key` (from `js/site-config.js`), `subject` (same "Website quote request — {NAME}"
template), `from_name` (business name or fallback), `email` (the visitor's email — becomes
reply-to), `botcheck` (honeypot, must be empty), and `message` = the same compiled
plain-text body as v1 (labels, "(not answered)" for blanks) plus `Phone:` line.
Response JSON `{ success: true }` on delivery.

`js/site-config.js` adds:
`export const WEB3FORMS_KEY = 'PENDING_KEY_FROM_FOUNDER';`
(Web3Forms access keys are public-by-design for client-side embeds — committing it is
correct, document that in the file comment. CONTACT_EMAIL stays for the fallback path.)

## Form changes
- New contact block ABOVE the notes field: "Your email" (type=email, autocomplete=email,
  required — the ONLY required field; inline friendly validation message from copy.md on
  blur/submit, aria-describedby wired) and "Phone (optional)" (type=tel, autocomplete=tel).
- Hidden honeypot input (`botcheck`, visually hidden, aria-hidden, tabindex=-1).
- Everything else (name, verticals, has-site, needs w/ mutual exclusion, notes) unchanged.

## Submit flow
1. Validate email; on fail show the inline message, focus the field, no request.
2. In flight: submit button disabled + label swaps to the copy.md sending label;
   AbortController timeout ~10s; Esc/close still works (abort the request).
3. Success (`success: true`): swap the form for the Sent state — headline + supporting
   line + Done button (from copy.md), `aria-live=polite` announcement; Done closes the
   overlay with the standard close path (focus restore etc.). Re-opening later shows a
   fresh form.
4. Failure (network error, timeout, non-success response): keep the form intact (nothing
   lost), show the error line + the "send by email instead" link-button — which fires the
   v1 mailto path (same compiled body, PLUS a `Reply to: <their email>` line since mailto
   can't set reply-to). No clipboard UI anymore — delete the v1 clipboard code.
5. Double-submit guarded; the compiled body/message never interpolates user input into
   HTML (textContent/value reads only, as established).

## Unchanged contracts (re-verify, don't re-solve)
Dialog a11y (focus trap, document-level Esc incl. from body, backdrop/X, display:none on
close, scroll lock), lazy import on trigger click with zero initial-load impact, 375px
usability, reduced-motion, no-JS fallback hrefs in index.html stay mailto.
The Preview Machine keeps its mailto CTA — only the quote form changes.

## Definition of done
Local live run: email-validation both paths; in-flight state visible; SUCCESS path tested
against the real Web3Forms endpoint ONCE with the real key (test lead clearly labeled,
e.g. business name "QA test — ignore") and `success:true` confirmed; failure path tested
by stubbing fetch to reject → error line + mailto fallback carries the full body incl.
Reply-to line; honeypot present but invisible; double-submit blocked; all dialog contracts
re-verified; console clean; initial network unchanged; screenshots qf2-form.png,
qf2-sending.png, qf2-sent.png, qf2-error.png, qf2-mobile.png. Update README (quote flow
now direct-submit via Web3Forms; key is public-by-design; monthly free-tier note).
