"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { AdminAuthProvider, useAdminAuth } from "@/components/admin/AdminAuth";
import { supabaseConfigured } from "@/lib/supabase/browser";
import { DEV_BYPASS } from "@/lib/dev-mode";
import { DEMO_MODE } from "@/lib/demo/config";

/**
 * Admin shell.
 *
 * The client-side redirect below is convenience, not security: every /api/admin
 * route independently verifies the staff JWT server-side (src/lib/auth.ts), so
 * a user who defeats this guard sees an empty screen and 401s, not data.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <Shell>{children}</Shell>
    </AdminAuthProvider>
  );
}

const NAV = [
  { href: "/admin/orders", label: "Παραγγελίες" },
  { href: "/admin/kitchen", label: "Κουζίνα" },
  { href: "/admin/menu", label: "Μενού" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { ready, session, email, signOut } = useAdminAuth();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isLogin = pathname.startsWith("/admin/login");

  useEffect(() => {
    if (ready && !session && !isLogin) router.replace("/admin/login");
  }, [ready, session, isLogin, router]);

  if (!supabaseConfigured && !DEV_BYPASS && !DEMO_MODE) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Το admin δεν είναι ρυθμισμένο</h1>
        <p className="mt-3 text-char/70">
          Λείπουν οι μεταβλητές NEXT_PUBLIC_SUPABASE_URL και
          NEXT_PUBLIC_SUPABASE_ANON_KEY. Δες το README.
        </p>
      </div>
    );
  }

  if (!ready) {
    return <div className="p-10 text-center text-char/60">Φόρτωση...</div>;
  }

  if (isLogin) return <>{children}</>;
  if (!session) return null;

  return (
    <div className="min-h-svh bg-sand">
      {DEMO_MODE && (
        <p className="bg-rust px-4 py-2 text-center text-sm font-bold text-onrust">
          DEMO - χωρίς σύνδεση, οι παραγγελίες είναι μόνο σε αυτόν τον browser
        </p>
      )}
      {DEV_BYPASS && (
        <p className="bg-rust px-4 py-2 text-center text-sm font-bold text-onrust">
          ΔΟΚΙΜΑΣΤΙΚΗ ΛΕΙΤΟΥΡΓΙΑ - χωρίς σύνδεση, οι πληρωμές είναι εικονικές
        </p>
      )}
      <header
        className="sticky top-0 z-40 border-b border-line bg-surface"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin/orders" className="font-display text-lg font-bold">
            Ρουβεράκι <span className="text-char/50">admin</span>
          </Link>

          <nav className="flex flex-1 gap-1" aria-label="admin">
            {NAV.filter((n) => !(DEMO_MODE && n.href === "/admin/menu")).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "inline-flex min-h-touch items-center rounded-full px-4 text-sm font-semibold transition-colors",
                  pathname.startsWith(n.href)
                    ? "bg-rust text-onrust"
                    : "text-char/70 hover:bg-char/5 hover:text-char",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-char/60 sm:inline">{email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="btn-ghost text-sm"
            >
              Έξοδος
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
