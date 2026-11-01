import { DEMO_MODE, LAUNCHED } from "@/lib/demo/config";

/**
 * Whether this build is a deployed test site rather than the real shop.
 *
 * True on any Vercel deployment whose payments are not live. Such a site
 * carries the restaurant's real name, address and menu, so without a label a
 * visitor who found it could "pay", see a confirmation, and wait for food that
 * nobody is going to cook. Two consequences follow from this flag:
 *
 *   - a visible notice on every page (QaBanner)
 *   - robots noindex, so the test URL never competes with the real one in search
 *
 * Local development is left alone: nobody indexes localhost, and the dev
 * server already announces its own test mode.
 *
 * Both inputs are read at build time, so flipping PAYMENT_MODE to live needs a
 * redeploy to drop the notice — which going live needs anyway.
 */
export const IS_TEST_DEPLOY =
  !LAUNCHED &&
  (DEMO_MODE ||
    (Boolean(process.env.VERCEL_ENV) && process.env.PAYMENT_MODE !== "live"));

/**
 * The public origin, used for canonical links, Open Graph and the tracking
 * link in order SMS.
 *
 * An explicit NEXT_PUBLIC_SITE_URL wins. Otherwise a Vercel deploy uses its own
 * production domain, which Vercel exposes to every build and function. Only
 * after both does it fall back to the shop's real domain, so a test deploy can
 * never send a customer a tracking link to a site the order is not on.
 */
export const siteUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "https://rouveraki.gr";
};
