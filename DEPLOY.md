# Deploying Rouveraki

Goal: a public URL you can open on your phone, running `PAYMENT_MODE=mock`, so
the whole order lifecycle is testable without Viva credentials.

Three things are needed: a **git remote**, a **Postgres database**, and a
**Vercel project**. The repo is already committed on `main`.

---

## Before anything: the Vercel tier question

You asked to be told about paid-tier walls before hitting one. There is one.

**Vercel's Hobby (free) plan is non-commercial only.** It is fine right now,
while this is you testing on your phone. The moment Rouveraki takes real
customer orders through it, that is commercial use and Vercel's terms require
**Pro ($20/month per member)**. Nothing in the build needs Pro; it is purely a
licensing line.

Everything else here fits Hobby comfortably:

| Thing this app does | Hobby limit | Fine? |
| --- | --- | --- |
| Server-rendered routes, API routes | included | yes |
| `images.unsplash.com` via next/image | 1000 source images/mo | yes |
| Cron jobs | not used | n/a |
| Function duration | 10s default | yes, slowest path is a Viva call |
| Bandwidth | 100 GB/mo | yes |

The one real constraint: **Hobby functions are stateless and scale to zero**,
which matters for two pieces of this app:

- The **in-memory rate limiter** (`src/lib/rate-limit.ts`) keeps its buckets per
  instance. On serverless that means the effective limit multiplies by the
  number of warm instances. Before real traffic, move it to Upstash Redis or a
  Postgres counter. It is already marked `TODO:SCALE`.
- The **mock payment store** (`src/lib/payments/mock.ts`) is a `Map` that resets
  when an instance recycles. Harmless in mock mode; irrelevant in live mode.

---

## 1. Database

Vercel has no database of its own that suits this. Pick one, all have a free
tier that is enough for testing:

| Option | Why |
| --- | --- |
| **Supabase** | Best fit. You need it anyway for admin auth and realtime, so one account covers all three. EU region available. |
| **Neon** | Simplest if you only want Postgres now and will add Supabase later. |
| **Railway** | Your account is already connected. Costs credit rather than being free-forever. |

With Supabase: create a project in an EU region, then take both connection
strings from Settings > Database (the pooled one on port 6543 and the direct one
on 5432).

Then, locally, point at it and push the schema once:

```bash
# in .env.local, temporarily
DATABASE_URL="<pooled connection string>"
DIRECT_URL="<direct connection string>"

npm run prisma:push
npm run seed
```

If you use Supabase, also run `supabase/policies.sql` in its SQL editor. That
revokes anon access to the order tables; skipping it would let anyone with the
public key read every customer's name, phone and address.

---

## 2. GitHub

```bash
# create an empty repo on github.com first, then:
git remote add origin https://github.com/<you>/rouveraki.git
git push -u origin main
```

The repo contains no secrets. `.env.local` is gitignored and `.env.example`
holds only empty placeholders; both were checked before the first commit.

---

## 3. Vercel

Both of these need a browser login, so run them yourself:

```bash
npm i -g vercel
vercel login
vercel link          # or import the GitHub repo at vercel.com/new
```

Then add the environment variables under Project Settings > Environment
Variables. **Never commit these.** The minimum for a working mock deployment:

```
PAYMENT_MODE          mock
DATABASE_URL          <pooled connection string>
DIRECT_URL            <direct connection string>
NEXT_PUBLIC_SITE_URL  https://<your-project>.vercel.app
SMS_PROVIDER          log
```

Add these too once Supabase is set up, to get a real admin login and realtime:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAILS          your@email.com
```

Do **not** set `DEV_BYPASS` or `NEXT_PUBLIC_DEV_BYPASS` on Vercel. The server
refuses to boot with either set in a production build, because they disable
admin authentication entirely. Until Supabase is configured, `/admin` on the
deployed URL will simply say it is not set up, which is the correct behaviour.

Push to `main` deploys production; every other branch gets its own preview URL.

---

## 4. Going live with real payments

Only after the mock path is verified on the deployed URL:

1. Get Viva credentials and set `VIVA_CLIENT_ID`, `VIVA_CLIENT_SECRET`,
   `VIVA_WEBHOOK_VERIFICATION_KEY`, `VIVA_WEBHOOK_SECRET`.
2. Set both the success and failure redirect URLs in the Viva dashboard to
   `https://<site>/checkout/return`.
3. Register the webhook at `https://<site>/api/webhooks/viva`. Viva activates it
   by GETting that URL and expecting the verification key back.
4. Set `VIVA_ENVIRONMENT=demo` and test the full IRIS and card flow in sandbox.
5. Have the accountant confirm the four items marked `TODO:ACCOUNTANT` in
   `src/lib/payments/fiscalisation.ts` — the VAT rates, the myDATA
   classification codes, the delivery-fee rate, and the credit-note flow.
6. Only then set `PAYMENT_MODE=live` and `VIVA_ENVIRONMENT=production`.

The app refuses to start in live mode with missing credentials rather than
failing every order at checkout.
