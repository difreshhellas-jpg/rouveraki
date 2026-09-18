# Checklist

Two lists. The first is what the owner must give you or confirm; the second is
what must be true before anyone taps "pay" for real.

## Owner confirmation (`TODO:OWNER` in code)

| Item | Where in code | Why it cannot be guessed |
| --- | --- | --- |
| Brand colours from the actual logo file | `globals.css` tokens, then `npm run contrast` | Placeholders are in the right family but are not the brand |
| Real photography | `menu_items.image` via `/admin/menu`; hero in `lib/images.ts` | Stock shots are stand-ins |
| The full menu with prices | `prisma/seed.ts` | Only categories are public; items and prices are invented stand-ins |
| Delivery zones, minimums, fees, ETAs | `lib/brand.ts` `DELIVERY_ZONES` | Not published anywhere; three placeholder zones ship |
| Two or three sentences of story | `components/StorySection.tsx` | Public history is thin; nothing invented |
| ΑΦΜ, ΔΟΥ, ΓΕΜΗ, legal entity name | `app/legal/layout.tsx` | Required on a Greek commercial site |
| Contact-form destination | `CONTACT_FORWARD_TO`, `RESEND_API_KEY` | Owner may prefer another channel |
| Viva payment method ids | `VIVA_PAYMENT_METHOD_ID_CARD/IRIS` | Differ per Viva account |
| Municipal alcohol-hour limits | `lib/hours.ts` `ALCOHOL_HOURS_RESTRICTED` | One phone call; one flag |
| Whether an 18+ checkbox suffices for alcohol delivery, or ID at the door | `checkout/page.tsx`, `legal/terms` | Regulatory; ask the accountant |
| SMS provider and sender id | `SMS_PROVIDER`, provider vars | Yuboto for Greek alphanumeric sender |

## Accountant confirmation (`TODO:ACCOUNTANT` in `lib/payments/fiscalisation.ts`)

1. VAT rates per category (13% served food/drink, 24% alcohol as shipped).
2. myDATA income classification type and category codes.
3. Whether the delivery fee follows the food rate.
4. The credit-note flow for refunds: full, partial, and post-capture rejection
   are three different documents.

## Before `PAYMENT_MODE=live`

- [ ] Every item above confirmed and replaced.
- [ ] `npm run verify` passes (47 in the reference, including VAT and HMAC).
- [ ] `npm run verify:api` passes **with `DEV_BYPASS` off**.
- [ ] `npm run contrast` passes both themes.
- [ ] `next build` clean; customer routes under 150 kB first-load.
- [ ] Real phone on real 4G, both themes, both languages. Devtools throttling
      is not a substitute.
- [ ] `supabase/policies.sql` run; anon cannot read `orders` (try it).
- [ ] Staff roles set in `app_metadata`; `ADMIN_EMAILS` emptied.
- [ ] `DEV_BYPASS` and `NEXT_PUBLIC_DEV_BYPASS` absent from the deployment.
- [ ] Viva sandbox: full IRIS and card flow, a rejection with refund, a
      customer self-cancel within the grace window.
- [ ] Viva webhook registered; GET on the endpoint returns the key.
- [ ] `VIVA_WEBHOOK_SECRET` set; a forged POST is ignored (test it).
- [ ] Both Viva redirect URLs point at `/checkout/return`.
- [ ] Vercel Pro if orders are real (Hobby is non-commercial).
- [ ] Rate limiter moved off in-memory if more than one instance.
- [ ] Line-by-line read of `api/webhooks/viva/route.ts` and
      `lib/payments/viva-provider.ts` by a person, the day before, with fresh
      eyes.

## The frequency table, for every animation added later

| How often the user sees it | Animate? |
| --- | --- |
| 100+ times a day (shortcuts, palette toggle) | Never |
| Tens of times a day (hover, list rows) | Remove or drastically reduce |
| Occasionally (sheet, toast, modal) | Standard, under 300ms |
| Rare / first time (intro, success) | Delight allowed |

If the reason is "it looks cool", it goes.
