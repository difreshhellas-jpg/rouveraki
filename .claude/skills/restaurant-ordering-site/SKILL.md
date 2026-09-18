---
name: restaurant-ordering-site
description: Build an owned online-ordering site for a restaurant, cafe or grill house (Greek market, Viva.com payments) from brand facts to a phone-testable deployment, without repeating the bugs found the first time. Use when asked to build, clone or adapt a food-ordering site, a kitchen/admin panel, or a mock-to-live payment switch. Reference build: Rouveraki, Xylokastro (C:\Users\maggi\rouveraki).
---

# Restaurant ordering site

The complete workflow that produced the Rouveraki build, in the order that
worked, with every trap that cost time already routed around. Follow the phases
in order. Each one ends with a verification that must pass before the next
begins; skipping a verification is how the first build lost a day.

Reference implementation: `C:\Users\maggi\rouveraki`. When in doubt about how a
piece should look, read the file there rather than re-deriving it.

## 0. Before writing code

**Ask for the brand facts and refuse to invent the rest.** You need: name (Greek
and Latin), address, phone, opening hours, delivery hours, menu categories, and
whether alcohol is sold. Everything else (menu items, prices, delivery zones,
story copy, brand colours from a logo) is a `TODO:OWNER` placeholder in code,
never a guess presented as fact.

**Check these three assumptions, they were all wrong last time:**

| Assumption | Reality | What to do |
| --- | --- | --- |
| `source.unsplash.com/800x800/?food` works | Retired, returns 503 | Direct Unsplash CDN ids (`images.unsplash.com/photo-...`), each one downloaded and looked at before assignment. See TRAPS.md §Images. |
| A named skill is installed | It may not be | `ls ~/.claude/skills` and `ls ~/skills/skills` first. Say which are present. |
| Vercel Hobby is fine for a shop | Non-commercial only | Fine for phone testing; Pro once real orders flow. Say so before deploying. |

**Load the skills in this order, at these points:**

| Phase | Skill | Path | Why then |
| --- | --- | --- | --- |
| 1 | `taste-skill` | `~/.claude/skills/taste-skill` | Declares the design read and dials before any UI. Also bans em-dashes, hand-rolled SVG icons, and `window.addEventListener('scroll')`, which are cheaper to avoid than remove. |
| 1 | `ui-ux-pro-max` | `~/.claude/skills/ui-ux-pro-max` | 44px touch targets, form/label rules, dark-mode pairing. Its motion content is 17 rows; do not use it for animation. |
| 6 | `improve-animations` | `~/skills/skills/improve-animations` | AUDIT.md is the eight-category audit. Run it against your own motion before calling it done. |
| 6 | `review-animations` | `~/skills/skills/review-animations` | STANDARDS.md has the exact curves, durations and thresholds. Cite them; never approximate. |
| 6 | `animate` | `~/skills/skills/animate` | RECIPES.md: button press, drawer, toast, scroll reveal, drag-to-dismiss, all in CSS. Start from a recipe. |
| 6 | `ask-sonner` | `~/skills/skills/ask-sonner` | API.md for the toast library. Use Sonner; do not hand-roll toasts. |
| 6 | `apple-design` | `~/skills/skills/apple-design` | The physical, fluid feel the sheets should have. Use Vaul; do not hand-roll a drawer. |

To give a new project all of them at once:

```bash
PROJ=/c/path/to/project
mkdir -p "$PROJ/.claude/skills"
cp -r ~/skills/skills/{animate,animation-vocabulary,review-animations,improve-animations,find-animation-opportunities,ask-sonner,apple-design} "$PROJ/.claude/skills/"
cp -r ~/.claude/skills/{ui-ux-pro-max,taste-skill} "$PROJ/.claude/skills/"
```

## 1. Scaffold and tokens

Do not run `create-next-app` interactively; it may be declined. Write
`package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`,
`postcss.config.mjs` by hand from the reference repo.

Stack that worked: Next.js 15.5 (App Router), React 19, Tailwind 3.4, Zustand 5,
Prisma 6, Zod, `@phosphor-icons/react`, `sonner`, `vaul`. **No Motion.** See
TRAPS.md §Motion for why.

Colour tokens live in `globals.css` as `--brand-x` **and** `--brand-x-rgb`
twins so Tailwind opacity modifiers work. Add an `--on-accent` token from the
start: white on a lightened dark-mode accent fails AA (it was 3.16:1). Run
`npm run contrast` after any colour change.

Fonts must carry Greek. Fraunces does not; Noto Serif and Inter do. Use
`next/font/google` with `subsets: ["greek", "latin"]`.

**Verify:** `npx tsc --noEmit`, `npm run contrast`.

## 2. Data and business rules

Prisma schema per the reference. Two non-negotiable additions to any spec:
`order_code` is `@unique` (it is the public credential), and there is a
`webhook_events` table keyed on the provider's event id (idempotency).

Put every business rule in `src/lib/` as a pure module with no framework
import, so it can be tested without a server:

- `order-status.ts`: the allowed-transitions table. Terminal states have an
  empty successor list. Reason-required and auto-refund sets are data, not ifs.
- `hours.ts`: both windows wrap midnight (shop 06:00-01:00, delivery
  08:00-00:00). A `closes` of `00:00` means 24:00. Resolve in Europe/Athens.
- `sanitize.ts`: strip C0/C1 controls, zero-width and bidi overrides, angle
  brackets; cap length. Notes are printed on kitchen tickets and go into SMS.
- `order-code.ts`: random, alphabet without 0/O/1/I/L, rejection sampling.
  Use `crypto.getRandomValues`, **not** `node:crypto` (TRAPS.md §node:crypto).
- `money.ts`: integer cents everywhere; `Prisma.Decimal` only at the edges.

**Verify:** `scripts/verify-rules.ts` (copy from reference, adapt). It must
pass before any API route exists.

## 3. Local database

No Docker and no Postgres on the machine. Use `embedded-postgres` via
`scripts/dev-db.ts`. **Create the database with `ENCODING 'UTF8' TEMPLATE
template0`**: the cluster inherits the Windows locale and makes a WIN1252
template that mangles every Greek string.

`prisma.config.ts` disables Prisma's implicit `.env` loading; load
`.env.local` with `dotenv` there and in every script run outside Next.

**Verify:** `npm run prisma:push && npm run seed`, then read three rows back
and check the Greek survived.

## 4. Order service and API

`transitionOrder()` in `order-service.ts` is the **only** writer of
`orders.status`. Inside one transaction: read, check legality, conditional
`updateMany` on `{id, status: from}` (so two staff tapping Accept cannot both
win), write the history row. Refund, SMS and realtime happen after commit and
can never roll it back.

The order route re-prices every line from the database. The client sends ids
and quantities only. Age gating, availability and zone minimums are enforced
here, not in the UI.

`publicOrderShape` (the tracking page's Prisma select) lives in its own tiny
module. Pages import it; if it lives in `order-service.ts` the page drags the
whole payment stack into the bundler's graph.

Rate limit on IP **and** phone. `x-forwarded-for` is attacker-controlled unless
the edge overwrites it; the phone limit is the backstop.

**Verify:** `scripts/verify-api.ts` against the running dev server. It must
refuse to run while `DEV_BYPASS` is set, or its admin-auth assertions are
meaningless. Use a random IP block and phone range per run, or the limiter
from the previous run fails the suite.

## 5. Payments

One interface, two providers, one switch: `PAYMENT_MODE=mock|live`. Mock is
not a stub: it builds the same `fiscalisationData` as live and asserts the VAT
lines balance to the cent. Both providers use **Web Crypto**, never
`node:crypto` (TRAPS.md).

Greek VAT: served food and drink and alcohol are different bands. Rates are
per category with an `assertFiscalTotalsBalance` on every receipt. Four things
are `TODO:ACCOUNTANT`: the rates, myDATA codes, delivery-fee rate, credit-note
flow.

The webhook verifies an HMAC over the raw body, then **re-reads the
transaction from the provider** and takes amount and merchant reference from
that, never the request. Idempotency ledger, amount matching, state machine.
Test the HMAC function directly (seven cases in the reference suite).

Startup guard (`instrumentation.ts`): refuse to boot with `PAYMENT_MODE=live`
and missing credentials, or with `DEV_BYPASS` in a production build.

**Verify:** 47 rule checks + 23 API checks in the reference. Match them.

## 6. Motion

Load the emilkowalski skills now, not earlier. Then:

1. Add the three easing tokens from STANDARDS.md to `globals.css`.
2. Button press: `transition: transform 160ms var(--ease-out)`, `:active
   scale(0.97)`. Hover gated on `(hover: hover) and (pointer: fine)`.
3. Toasts: Sonner, bottom-centre, `offset.bottom` and `mobileOffset.bottom`
   both clear the floating cart bar (6rem).
4. Sheets: Vaul. It does pointer capture, multi-touch protection, friction and
   velocity dismissal correctly; the hand-rolled version did not.
5. Scroll reveal: clip-path wipe, one IntersectionObserver that disconnects,
   stagger 30-80ms. Customer pages only. Admin gets none.
6. Header scrolled state: an observed 1px sentinel, never a scroll listener.
7. Intro: 2s CSS keyframes, `pointer-events: none`, unmount when done, once
   per tab session, hidden under reduced motion.
8. Lazy-load the sheets with `next/dynamic` so the drawer library is not on
   first paint.

Then run AUDIT.md's eight categories against your own code and grep for
`transition: all`, `ease-in`, animated layout properties, and delays over 80ms.

**Verify:** `next build`; every customer route under 150 kB first-load. The
reference lands at / 124, /menu 136, /checkout 120, /order 116.

## 7. Admin

`/admin/orders`, `/admin/kitchen`, `/admin/menu` behind Supabase Auth with a
staff role in `app_metadata` (never `user_metadata`; that is user-writable).
`withStaff()` wraps every admin route server-side; the client redirect is
convenience only.

`DEV_BYPASS` opens admin without Supabase for local testing. It is a separate
flag from `PAYMENT_MODE` on purpose and refuses to exist in production.

Realtime is Supabase **broadcast**, not `postgres_changes`: listening to the
orders table would need anon SELECT on customer PII. `supabase/policies.sql`
revokes that and authorises the private staff channel.

## 8. Verify in a browser, correctly

Chrome tabs opened by the automation are usually **hidden**, so
`requestAnimationFrame` never fires and every animation reads as frozen at its
initial frame. Before blaming code, check `document.visibilityState`. Use
`computer` clicks and screenshots (which foreground the tab), and for anything
shorter than the screenshot round-trip (a 3.6s toast, a 2s intro), temporarily
lengthen it, screenshot, revert.

`curl` on a Greek Windows locale sends Greek as mojibake. Seed test data from a
Node script with `Content-Type: application/json; charset=utf-8`.

## 9. Deploy

Commit only after confirming `.env.local` is gitignored and `.env.example` has
empty values. Write `DEPLOY.md` from the reference. The database is a decision
with a bill attached (Supabase free, Neon free, Railway credit); do not
provision it unasked. `vercel login` needs the person's browser; hand them the
command.

Then run CHECKLIST.md with the owner.

## Files to copy verbatim from the reference

`scripts/verify-rules.ts`, `scripts/verify-api.ts`, `scripts/check-contrast.ts`,
`scripts/dev-db.ts`, `scripts/clear-orders.ts`, `src/lib/payments/*`,
`src/lib/order-service.ts`, `src/lib/order-status.ts`, `src/lib/sanitize.ts`,
`src/lib/hours.ts`, `src/app/api/webhooks/viva/route.ts`, `src/instrumentation.ts`,
`supabase/policies.sql`, `DEPLOY.md`. Adapt names and categories; keep the shape.

See TRAPS.md for every bug hit and CHECKLIST.md for what the owner must confirm.
