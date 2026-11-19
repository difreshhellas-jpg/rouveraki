import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Serif_Display } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { BRAND } from "@/lib/brand";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartBar from "@/components/CartBar";
import InstallPrompt from "@/components/InstallPrompt";
import { ToastProvider } from "@/components/Toaster";
import Intro from "@/components/Intro";
import OfferPopup from "@/components/OfferPopup";
import { IS_TEST_DEPLOY, siteUrl as resolveSiteUrl } from "@/lib/site-mode";

/**
 * Greek is the default language, so both faces must carry the full Greek set.
 * The design-system generator's picks (Playfair Display SC + Karla) ship no
 * Greek subset at all, verified against the Google Fonts CSS API. These are
 * the closest faces that do: Noto Serif Display is the high-contrast display
 * cut (the Playfair role), Manrope the clean geometric body.
 */
const display = Noto_Serif_Display({
  subsets: ["greek", "latin"],
  // Variable font: one file per subset and style covers every weight, instead
  // of a separate file for each of 400-700.
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["greek", "latin"],
  // Variable font (200-800): one file per subset.
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Both spellings in the title: people search "Rouveraki" in Latin letters
  // as often as "Ρουβεράκι", and Google matches the words that are there.
  title: {
    default: `${BRAND.nameEl} (${BRAND.nameEn}) — Καφέ & Ψησταριά στο Ξυλόκαστρο`,
    template: `%s · ${BRAND.nameEl} ${BRAND.nameEn}`,
  },
  description:
    "Ρουβεράκι (Rouveraki): καφές, ψησταριά και delivery στη μαρίνα του Ξυλοκάστρου. Πίτες, καλαμάκια, μερίδες στα κάρβουνα. Ανοιχτά καθημερινά 06:00–24:00, παραγγελία online 12:00–24:00.",
  applicationName: BRAND.nameEl,
  keywords: [
    "Ρουβεράκι", "Rouveraki", "Ξυλόκαστρο", "Xylokastro", "ψησταριά Ξυλόκαστρο",
    "delivery Ξυλόκαστρο", "καφέ Ξυλόκαστρο", "σουβλάκια Ξυλόκαστρο", "μαρίνα Ξυλοκάστρου",
  ],
  openGraph: {
    type: "website",
    locale: "el_GR",
    alternateLocale: ["en_US"],
    siteName: `${BRAND.nameEl} · ${BRAND.nameEn}`,
    title: `${BRAND.nameEl} (${BRAND.nameEn}) — Ξυλόκαστρο`,
    description: BRAND.taglineEl,
    url: "/",
    images: [{ url: "/images/rouveraki-terrace.jpg", alt: BRAND.taglineEl }],
  },
  twitter: { card: "summary_large_image" },
  // Each page names itself as canonical ("./" resolves against the page's own
  // URL). A fixed home URL here made /menu and the legal pages tell Google
  // they were copies of the homepage, so only the homepage could be indexed.
  alternates: { canonical: "./" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // Google Search Console: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the code
  // from the "HTML tag" method to verify the site and submit the sitemap.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  // A static file rather than app/manifest.ts, so the shop screen can point
  // to its own manifest (demo-kitchen/layout.tsx) and install as its own app.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ρουβεράκι", statusBarStyle: "default" },
  // A test deploy carries the real name and address; keep it out of search so
  // it never outranks or impersonates the live shop. See lib/site-mode.ts.
  robots: IS_TEST_DEPLOY
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Light is the starting theme for everyone, so the browser bar matches it.
  themeColor: "#fbf6ee",
};

/**
 * Applied before first paint so a visitor who chose a theme never sees a flash
 * of the other one. Light is the start for everyone (whatever the phone is set
 * to); dark only once the visitor picks it with the toggle.
 */
const themeBootstrap = `
var t = 'light';
try {
  var s = localStorage.getItem('rouveraki.theme');
  if (s === 'dark' || s === 'light') t = s;
} catch (e) {}
document.documentElement.dataset.theme = t;
try {
  if (sessionStorage.getItem('rouveraki.intro.seen') === '1') document.documentElement.setAttribute('data-intro-seen', '');
} catch (e) {}
`;

/** Structured data — a restaurant's hours and address are what search reads. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: BRAND.nameEl,
  alternateName: BRAND.nameEn,
  description: BRAND.taglineEl,
  telephone: BRAND.phone.tel,
  url: siteUrl,
  image: `${siteUrl}/images/rouveraki-terrace.jpg`,
  logo: `${siteUrl}/icons/icon-512.png`,
  hasMenu: `${siteUrl}/menu`,
  sameAs: [BRAND.facebook],
  servesCuisine: ["Greek", "Grill", "Cafe"],
  priceRange: "€€",
  address: {
    "@type": "PostalAddress",
    streetAddress: BRAND.address.street,
    addressLocality: BRAND.address.city,
    addressRegion: BRAND.address.region,
    postalCode: BRAND.address.postalCode,
    addressCountry: BRAND.address.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: BRAND.geo.lat,
    longitude: BRAND.geo.lng,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday",
      ],
      opens: BRAND.hours.opens,
      closes: BRAND.hours.closes,
    },
  ],
  hasDeliveryMethod: "https://schema.org/OnSitePickup",
  acceptsReservations: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="el" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${display.variable} ${sans.variable} tex-linen`}>
        <LanguageProvider>
          <Header />
          <main id="content">{children}</main>
          <Footer />
          <CartBar />
          <InstallPrompt />
          <OfferPopup />
          <ToastProvider />
          <Intro />
        </LanguageProvider>
      </body>
    </html>
  );
}
