# Ρουβεράκι — Rouveraki, Xylokastro

Owned online ordering for Rouveraki: café from 06:00, grill house through the
day, bar until 01:00. Built to replace third-party commission on efood/BOX.gr.

Payments run behind a single switch. `PAYMENT_MODE=mock` (the default) makes no
network call and auto-confirms with a fake reference, so the whole lifecycle is
testable with zero API keys. `PAYMENT_MODE=live` uses Viva Smart Checkout and
Fiscalisation for Online Sales. Both implement one provider interface, so there
is no second code path. See `src/lib/payments/index.ts`.

To put it on your phone, see **[DEPLOY.md](DEPLOY.md)**.

---

## Quick start

```bash
npm install

# 1. a throwaway local Postgres (no Supabase account needed)
npm run db:up          # keep this running; prints the DATABASE_URL to use

# 2. point .env.local at it, then
npm run prisma:push
npm run seed

# 3. run it
npm run dev            # http://localhost:3000
```

Copy `.env.example` to `.env.local` first and fill in what you have. Nothing
except `DATABASE_URL` is required to browse the site and place cash orders.

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run db:up` | local throwaway Postgres on port 55432 (dev only) |
| `npm run db:reset` | wipe that database and start clean |
| `npm run db:clear-orders` | empty the order queue, keep the menu (localhost only) |
| `npm run prisma:push` | apply the schema |
| `npm run seed` | load the menu |
| `npm run verify` | business-rule checks, no database needed |
| `npm run verify:api` | end-to-end checks against a running dev server |
| `npm run contrast` | WCAG AA audit of the brand palette |
| `npm run lint` | ESLint |

`verify:api` needs the `react-server` export condition because it imports
server-only modules directly:

```bash
NODE_OPTIONS="--conditions=react-server" BASE=http://localhost:3000 npm run verify:api
```

---

## What is where

```
prisma/schema.prisma      the data model (spec §5)
supabase/policies.sql     RLS, realtime authorisation, GDPR retention job
src/lib/brand.ts          confirmed brand facts, categories, delivery zones
src/lib/order-status.ts   the order state machine — the only definition of it
src/lib/order-service.ts  the ONLY writer of orders.status
src/lib/viva.ts           Viva Smart Checkout client
src/lib/hours.ts          opening hours, including the midnight-wrapping windows
src/app/api/webhooks/viva the payment webhook — read this before launch
src/app/admin/            staff: orders, kitchen queue, menu CRUD
```

### Two rules worth knowing before editing

1. **`orders.status` is written in exactly one place** —
   `transitionOrder()` in `src/lib/order-service.ts`. It checks the transition,
   writes the history row, fires the refund, sends the SMS and publishes the
   realtime event as one unit. Writing the column anywhere else silently breaks
   three of those five.
2. **The client never sets a price.** The order API takes item ids and
   quantities only, and re-reads prices, availability and the age-gate flag from
   the database. A tampered cart cannot change what is charged.

---

## Configuration you must confirm before launch

Everything below is marked `TODO:OWNER` in the code and is a placeholder today.

| what | where | why it is not filled in |
| --- | --- | --- |
| Brand colours | `src/app/globals.css` | sampled placeholders; take the real values off the Rouveraki logo, then re-run `npm run contrast` |
| Photography | `src/lib/photos.ts` | the site is photo-led by design; gradients stand in until real shots exist, and the layout does not shift when they land |
| The menu itself | `prisma/seed.ts` | the twelve categories are confirmed; the items and prices are a realistic stand-in and must be replaced |
| Delivery zones, minimums, fees | `src/lib/brand.ts` | not published anywhere public — ask the owner |
| The story paragraphs | `src/components/StorySection.tsx` | Rouveraki's public history is thin; nothing invented, needs 2–3 real sentences from the owner |
| ΑΦΜ / ΔΟΥ / ΓΕΜΗ | `src/app/legal/layout.tsx` | legally required on a Greek commercial site |
| Viva payment method ids | `.env` | the numeric ids differ per account; read them off the Viva dashboard |
| Alcohol sale hours | `src/lib/hours.ts` | one phone call to the municipality; if restricted, flip one flag |

---

## Deploying

### Database and realtime — Supabase

1. Create a Supabase project (EU region).
2. Put the pooled connection in `DATABASE_URL` and the direct one in
   `DIRECT_URL`.
3. `npm run prisma:push && npm run seed`.
4. Run `supabase/policies.sql` in the SQL editor. This is **not optional** — it
   revokes anon/authenticated access to the order tables and sets up staff
   authorisation for the realtime channel.
5. Invite staff through Supabase Auth, then give each one a role:
   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"staff"}'::jsonb
    where email = 'someone@example.com';
   ```
   `ADMIN_EMAILS` is a bootstrap allowlist for the first login; empty it once
   real roles exist.

Realtime uses **broadcast channels**, not `postgres_changes`. Listening to table
changes would require letting the anon key read `orders`, which hands every
customer every other customer's name, phone and address.

### Payments — Viva.com

1. Start with `VIVA_ENVIRONMENT="demo"` and the sandbox credentials.
2. Set both the success and failure redirect URLs in the Viva dashboard to
   `https://<site>/checkout/return`.
3. Register the webhook at `https://<site>/api/webhooks/viva`. Viva activates it
   by GETting that URL and expecting `VIVA_WEBHOOK_VERIFICATION_KEY` back.
4. Test the full IRIS and card flow in sandbox before switching to production.

The app refuses to start in production with live Viva credentials while
fiscalisation is still a stub — see below.

---

## Payments, fiscal receipts and the webhook

All three are built. What remains is confirmation, not code.

**The switch** is `PAYMENT_MODE`. Mock mode is not a stub: it builds the same
`fiscalisationData` object as live mode and asserts the VAT lines balance to the
cent, so a fiscal error shows up on a test order rather than on the first real
receipt.

**VAT** is the part worth knowing about. Greek food service and alcohol are not
the same rate, and this menu spans coffee, souvlaki and spirits. Rates are
per-category in `src/lib/payments/fiscalisation.ts`, currently 13% for served
food and drink and 24% for alcohol. Four things there are marked
`TODO:ACCOUNTANT` and must be confirmed before going live: the rates
themselves, the myDATA classification codes, whether the delivery fee follows
the food rate, and the credit-note flow for a refund.

**The webhook** (`src/app/api/webhooks/viva/route.ts`) never trusts the request
body. It checks an HMAC-SHA256 signature over the raw bytes, then re-reads the
transaction from the provider with our own credentials and takes the amount and
merchant reference from that response. It also enforces idempotency, amount
matching and the state machine. The signature function has its own tests in
`npm run verify`. It still deserves a line-by-line read before money moves.

**Still genuinely outstanding:** an adversarial security review of checkout, the
webhook and admin auth together, and the real-device pass on 4G.

## Verification status

- `npm run verify` — 47 business-rule checks pass, including VAT splitting and
  webhook signature verification
- `npm run verify:api` — 23 end-to-end checks pass against a real Postgres,
  covering the age gate, cart tampering, zone minimums, unauthenticated admin
  access, a forged payment webhook, and concurrent staff transitions.
  Refuses to run while `DEV_BYPASS` is on, because the admin-auth assertions
  would be meaningless.
- `npm run contrast` — passes AA in both light and dark
- `npm run build` — clean
- **Not done:** the real-device pass on 4G. It needs a phone, and devtools
  throttling is not a substitute.

### First-load JS

The animation layer costs about 45 kB. Customer routes:

| Route | First load |
| --- | --- |
| `/checkout` | 120 kB |
| `/order/[code]` | 116 kB |
| `/` | 166 kB |
| `/menu` | 172 kB |

The home and menu pages are over the 150 kB target set at the start of the
project. That is the price of Motion, which is what makes the sheets, toasts
and cart bar feel physical rather than like CSS fades. If the budget matters
more than the motion, the lever is `src/components/Reveal.tsx` and
`src/components/Toaster.tsx`: reverting those two to CSS transitions removes
Motion from the homepage entirely. LazyMotion was tried and made it worse here,
because the feature chunk still counts as first-load from a root-layout
provider.
