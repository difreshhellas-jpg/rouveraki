import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Serif_Display } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { BRAND } from "@/lib/brand";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartBar from "@/components/CartBar";
import { ToastProvider } from "@/components/Toaster";
import Intro from "@/components/Intro";
import QaBanner from "@/components/QaBanner";
import DemoBadge from "@/components/DemoBadge";
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
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["greek", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.nameEl} — Ξυλόκαστρο`,
    template: `%s · ${BRAND.nameEl}`,
  },
  description:
    "Καφές, ψησταριά και ποτό στη μαρίνα του Ξυλοκάστρου. Ανοιχτά καθημερινά 06:00–01:00, διανομή 08:00–00:00.",
  openGraph: {
    type: "website",
    locale: "el_GR",
    siteName: BRAND.nameEl,
    title: `${BRAND.nameEl} — Ξυλόκαστρο`,
    description: BRAND.taglineEl,
    url: siteUrl,
  },
  alternates: { canonical: siteUrl },
  icons: { apple: "/icons/apple-touch-icon.png" },
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1815" },
  ],
};

/**
 * Applied before first paint so a visitor who chose a theme never sees a flash
 * of the other one. Kept tiny and dependency-free on purpose.
 */
const themeBootstrap = `
try {
  var t = localStorage.getItem('rouveraki.theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
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
  sameAs: [BRAND.facebook],
  servesCuisine: ["Greek", "Grill", "Cafe", "Bar"],
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
    <html lang="el" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${display.variable} ${sans.variable} tex-linen`}>
        <LanguageProvider>
          <QaBanner />
          <Header />
          <main id="content">{children}</main>
          <Footer />
          <CartBar />
          <ToastProvider />
          <Intro />
          <DemoBadge />
        </LanguageProvider>
      </body>
    </html>
  );
}
