---
name: restaurant-ordering-site
description: Build an owned online-ordering site for a restaurant, cafe or grill house (Greek market, Viva.com payments) from brand facts to a phone-testable deployment, without repeating the bugs found the first time. Carries the exact layout, photography, twelve-category structure and cinematic scroll animations of the reference build in LAYOUT.md, so a new site can be an exact reproduction with different words in it. Use when asked to build, clone or adapt a food-ordering site, a kitchen/admin panel, a mock-to-live payment switch, or CSS scroll-driven animation (pinned horizontal pan, scroll-break wipe, hero pull-back). Reference build: Rouveraki, Xylokastro (C:\Users\maggi\rouveraki).
---

# Restaurant ordering site

The complete workflow that produced the Rouveraki build, in the order that
worked, with every trap that cost time already routed around. Follow the phases
in order. Each one ends with a verification that must pass before the next
begins; skipping a verification is how the first build lost a day.

Reference implementation: `C:\Users\maggi\rouveraki`. When in doubt about how a
piece should look, read the file there rather than re-deriving it.

**LAYOUT.md is the finished specification** — exact section order, exact photo
ids and where each one is used, exact animation parameters and ranges, the
twelve categories. It opens with nine screenshots of the shipped site in
`reference/`; look at those first, because they are what all the numbers are
supposed to add up to. This file tells you the order to build in; that one
tells you what to build. Read both before starting.

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

**Run the design-system generator before choosing a single colour:**

```bash
python ~/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "<cuisine> <venue type> <city> restaurant ordering premium consumer" \
  --design-system -p "<Name>" -f markdown --variance 6 --motion 6 --density 4
```

Take its direction, palette and effects. The first Rouveraki build guessed
its own palette and the result looked like mud next to the food photography;
the generator's warm black + gold was right first time. Then verify every
font it names for a Greek subset (TRAPS.md §Design pass) and substitute the
closest face that has one. Declare the taste-skill design read and dials in
one line before writing CSS.

Do not run `create-next-app` interactively; it may be declined. Write
`package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`,
`postcss.config.mjs` by hand from the reference repo.

Give `next.config.ts` `distDir: process.env.NEXT_DIST_DIR || ".next"` now
rather than later. Without it, every verification build overwrites the `.next`
the dev server is reading from and dev starts throwing
`Cannot find module './331.js'`. It also rewrites `tsconfig.json` to reference
the temporary output directory, so check that file before committing.

Tokens are **semantic** (`paper`, `surface`, `ink`, `stone`, `line`, `band`,
`accent`, `accent-bright`, `on-accent`) with hex and `-rgb` twins, tinted
shadows as variables, and the three easing curves. Header is a translucent
material (`.glass`), buttons are a lit gradient with an inset top edge, cards
get CSS 3D tilt on fine pointers (`Tilt.tsx`). Route changes use
`experimental.viewTransition`.

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

Two things about running it that are not obvious:

- `tsx --conditions react-server`. Without it the script dies on `server-only`
  with "This module cannot be imported from a Client Component module".
- The suite is **silently time-dependent**. The shop is shut 01:00-06:00, so
  overnight every order check returns `409 shop_closed`, and because that guard
  runs before the age check the failure names the wrong assertion
  (`409 !== 400`). Give `hours.ts` a `TEST_CLOCK` override, refused when
  `NODE_ENV === "production"`, and pin the test server to mid-service.

Run it on its own port with its own dist dir so the person's preview survives:

```bash
TEST_CLOCK="2026-09-21T14:00:00Z" DEV_BYPASS="" NEXT_PUBLIC_DEV_BYPASS="" \
  NEXT_DIST_DIR=.next-verify-dev npx next dev -p 3111
BASE=http://localhost:3111 DEV_BYPASS="" NEXT_PUBLIC_DEV_BYPASS="" \
  npx tsx --conditions react-server scripts/verify-api.ts
```

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

**Verify:** every customer route under 150 kB first-load. After the cinematic
pass the reference lands at / 142, /menu 149, /checkout 132, /order 129.

Run the build as `NEXT_DIST_DIR=.next-verify npx next build`. A build into the
same `.next` that `next dev` is serving from leaves dev throwing
`Cannot find module './331.js'` until the directory is deleted, so give the
config `distDir: process.env.NEXT_DIST_DIR || ".next"` back in phase 1.

## 6b. The cinematic pass

Do this **after** phase 6 passes, never instead of it. The base motion is what
makes the site feel built; this is what stops it looking templated. Build the
sections in LAYOUT.md §4, in this order, verifying each before the next.

All of it is CSS scroll-driven animation. No GSAP, no ScrollTrigger, no
Lenis. The whole pass cost 3 kB in the reference because of that, and the
site's own CSP (`script-src 'self'`) would block a CDN script anyway.

1. **Hero pull-back.** Photo stack scales down and blurs on `exit`; a plain
   rgba veil fades in; the copy lifts and fades. The blur goes on the stack —
   a `backdrop-filter` veil forms its own backdrop root and, inside a section
   carrying `contain: paint`, blacks the hero out even at `opacity: 0`.
2. **Pinned horizontal story.** Named timeline on the tall outer section,
   `view-timeline-inset: 0`, rail not a flex container, geometry from
   `--panels`. All three are covered in TRAPS.md; each one alone freezes the
   pan at panel one.
3. **Scroll-break wipe.** Same named-timeline rules. It must carry a
   photograph and a display line, or it is an invisible animation that still
   costs scroll distance.
4. **Wireframe accent.** Hand-rolled 2D canvas, ~2 kB. Three.js is roughly
   150 kB gzipped to draw thirty lines on a 150 kB budget. Reach for a real 3D
   library only when the geometry needs lighting, materials or a loaded model.
   Pause on IntersectionObserver and `visibilitychange`.
5. **Cursor trail.** Capped point buffer, self-stopping loop, fine pointers
   only. There is no touch equivalent and nothing to substitute.
6. **Interactive menu preview.** Every preview image rendered and stacked,
   switching on opacity, so a swap never waits on a request. Rows are real
   links into `/menu#<slug>`; hover, focus and touch set the same state.

**Verify, in this order:**

- Each effect at desktop width, by screenshot, compared against the matching
  plate in `reference/`. Measuring the DOM is not looking; that mistake is what
  shipped an invisible page once already.
- Each effect at phone width. The pan must become a real swipeable carousel,
  not a vertical list.
- `prefers-reduced-motion: reduce` degrades every section to a static, fully
  readable page.
- `NEXT_DIST_DIR=.next-verify npx next build`, still under 150 kB.

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

Chrome tabs opened by the automation render **offscreen**:
`document.visibilityState` is `"hidden"` and `outerWidth`/`outerHeight` are 0,
even when the tab is the group's `selectedTabId`. Foregrounding the window does
not change it. This is the single biggest time-waster in the whole build, so
check it in one call before touching any code:

```js
document.visibilityState   // "hidden" => stop, your CSS is probably fine
anim.pending               // true with a live timeline => same thing
```

What it breaks:

- **Scroll-driven animations never start.** The timeline reports a real
  `currentTime`, but every animation attached to it sits at `pending: true`,
  `startTime: null`, `currentTime: null` forever. A time-based animation works
  fine, which makes it look like a CSS bug.
- **`await requestAnimationFrame` hangs**, and the evaluate call dies with
  "the renderer may be frozen".  Use `setTimeout` only.
- **`scrollTo()` silently does nothing** when the page sets
  `scroll-behavior: smooth`. Set
  `document.documentElement.style.scrollBehavior = 'auto'` first.
- **The viewport cannot be resized.** `resize_window` moves the window, not the
  page. To test a breakpoint, rewrite the condition in the live CSSOM
  (`rule.media.mediaText = '(min-width: 0px)'`) to force the block on. That
  exercises the rule bodies, which is where the bugs are, but not the
  breakpoint value, so say so rather than claiming a phone test.

A screenshot forces a frame and unsticks pending animations, so the working
pattern is **set scroll, screenshot, then measure** — never measure straight
after scrolling. Repeated screenshots in quick succession wedge the renderer; a
reload recovers it. For anything shorter than the screenshot round-trip (a 3.6s
toast, a 2s intro), temporarily lengthen it, screenshot, revert.

`curl` on a Greek Windows locale sends Greek as mojibake. Seed test data from a
Node script with `Content-Type: application/json; charset=utf-8`.

## 9. Deploy

Commit only after confirming `.env.local` is gitignored and `.env.example` has
empty values. Write `DEPLOY.md` from the reference. The database is a decision
with a bill attached (Supabase free, Neon free, Railway credit); do not
provision it unasked. `vercel login` needs the person's browser; hand them the
command.

For a **QA deploy** the order that worked, all non-interactive once `vercel`
and `gh` are signed in:

1. Scan history for secrets, then `gh repo create <owner>/<name> --private
   --source=. --push`.
2. `vercel link --yes --project <name>`, then fix the `.env*` line it adds
   to `.gitignore`.
3. `vercel integration add supabase ... --plan free --no-env-pull`.
4. Map the two database URLs; set `PAYMENT_MODE=mock`, `SMS_PROVIDER=log`,
   `VIVA_ENVIRONMENT=demo`. Never `DEV_BYPASS`; the startup guard refuses it
   in a production build, correctly.
5. `prisma db push`, apply `supabase/policies.sql`, seed, then prove the
   lockdown with the anon key.
6. Create a QA staff user through the Auth admin API with
   `app_metadata.role = "staff"`, not the owner's personal email.
7. Push to deploy, then QA the live URL end to end: guards, an order, the
   tracking payload's privacy, staff sign-in, the full kitchen path, a
   rejection, and realtime delivery to both channels. Read the runtime logs;
   the realtime bug only showed up there.

Every trap on that path is in TRAPS.md §Deploying the QA site.

Then run CHECKLIST.md with the owner.

## Files to copy verbatim from the reference

`scripts/verify-rules.ts`, `scripts/verify-api.ts`, `scripts/check-contrast.ts`,
`scripts/dev-db.ts`, `scripts/clear-orders.ts`, `src/lib/payments/*`,
`src/lib/order-service.ts`, `src/lib/order-status.ts`, `src/lib/sanitize.ts`,
`src/lib/hours.ts`, `src/app/api/webhooks/viva/route.ts`, `src/instrumentation.ts`,
`supabase/policies.sql`, `DEPLOY.md`, and the whole of
`src/components/cinematic/` and `src/components/motion/`. Adapt names and
categories; keep the shape. For the cinematic CSS, copy the
`cinematic scroll sections` block of `globals.css` wholesale rather than
retyping ranges.

See LAYOUT.md for the exact build, TRAPS.md for every bug hit, and
CHECKLIST.md for what the owner must confirm.
