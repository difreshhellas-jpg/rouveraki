import Link from "next/link";
import { BRAND } from "@/lib/brand";

const PAGES = [
  { href: "/legal/terms", label: "Όροι Χρήσης" },
  { href: "/legal/privacy", label: "Πολιτική Απορρήτου" },
  { href: "/legal/cookies", label: "Πολιτική Cookies" },
  { href: "/legal/refunds", label: "Πολιτική Επιστροφών" },
  { href: "/legal/allergens", label: "Αλλεργιογόνα" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <nav aria-label="legal" className="mb-8 flex flex-wrap gap-2">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-char/75 hover:text-char"
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {/*
        TODO:LAWYER — these pages are drafted from the obligations that apply to
        a Greek restaurant selling online (consumer information, GDPR, fiscal
        receipts, distance-selling withdrawal rules and their food exemption).
        They are a working starting point, not legal advice, and must be read by
        the accountant and/or a lawyer before launch. Every place needing a real
        answer is marked inline.
      */}
      <article
        className="
          prose-headings:font-display space-y-5
          [&_a]:text-rust [&_a]:underline [&_a]:underline-offset-4
          [&_h1]:text-[clamp(1.9rem,6vw,2.75rem)] [&_h1]:font-bold [&_h1]:leading-tight
          [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold
          [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold
          [&_li]:leading-relaxed
          [&_p]:leading-relaxed [&_p]:text-char/80
          [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:text-char/80
        "
      >
        {children}
      </article>

      <footer className="mt-12 border-t border-line pt-6 text-sm text-char/60">
        <p>
          {BRAND.nameEl} · {BRAND.address.street}, {BRAND.address.city}{" "}
          {BRAND.address.postalCode} ·{" "}
          <a href={`tel:${BRAND.phone.tel}`} className="text-rust underline underline-offset-4">
            {BRAND.phone.display}
          </a>
        </p>
        <p className="mt-2">
          {/* TODO:OWNER — ΑΦΜ, ΔΟΥ, ΓΕΜΗ and the legal entity name are required
              on a Greek commercial site. Add them here. */}
          ΑΦΜ / ΔΟΥ / ΓΕΜΗ: <em>να συμπληρωθεί</em>
        </p>
      </footer>
    </div>
  );
}
