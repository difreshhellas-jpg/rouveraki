import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center px-4 text-center sm:px-6">
      <p className="font-display text-6xl font-bold text-rust">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">
        Η σελίδα δεν βρέθηκε
      </h1>
      <p className="mt-3 text-char/70">
        Ίσως ο σύνδεσμος έχει αλλάξει. Δοκίμασε από το μενού.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-secondary">
          Αρχική
        </Link>
        <Link href="/menu" className="btn-primary">
          Δες το μενού
        </Link>
      </div>
      <a
        href={`tel:${BRAND.phone.tel}`}
        className="mt-6 text-sm font-semibold text-rust underline underline-offset-4"
      >
        {BRAND.phone.display}
      </a>
    </div>
  );
}
