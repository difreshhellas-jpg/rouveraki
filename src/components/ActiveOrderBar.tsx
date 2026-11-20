"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";
import { apiFetch } from "@/lib/api";
import { isOrderStatus, isTerminal, type OrderStatus } from "@/lib/order-status";
import { clearActiveOrder, onActiveOrderChange, readActiveOrder } from "@/lib/active-order";

/**
 * A slim bar under the header while the visitor has an order in progress, so
 * they can browse the site and get back to their order in one tap. Checks the
 * order every 30 s and disappears by itself once it is delivered or cancelled.
 */
export default function ActiveOrderBar() {
  const { pick } = useI18n();
  const pathname = usePathname() ?? "/";
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);

  useEffect(() => {
    const read = () => setCode(readActiveOrder()?.code ?? null);
    read();
    return onActiveOrderChange(read);
  }, []);

  useEffect(() => {
    if (!code) return;
    let dead = false;
    const check = () =>
      apiFetch(`/api/orders/${code}`)
        .then((r) => (r.status === 404 ? { order: null } : r.ok ? r.json() : undefined))
        .then((d: { order: { status: string } | null } | undefined) => {
          if (dead || d === undefined) return;
          const s = d.order?.status;
          if (!d.order || !isOrderStatus(s) || isTerminal(s)) {
            clearActiveOrder(code);
            return;
          }
          setStatus(s);
        })
        .catch(() => {});
    void check();
    const id = window.setInterval(check, 30_000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, [code]);

  if (!code || !status) return null;
  if (pathname.startsWith("/order/") || pathname.startsWith("/admin") || pathname.startsWith("/demo-kitchen")) {
    return null;
  }

  const label =
    status === "PENDING_PAYMENT" || status === "PAID_AWAITING_ACCEPTANCE"
      ? pick("Περιμένει επιβεβαίωση", "Awaiting confirmation")
      : status === "DISPATCHED"
        ? pick("Έρχεται προς εσένα", "On its way to you")
        : pick("Ετοιμάζεται", "Being prepared");

  return (
    <div className="border-t border-success/30 bg-success/10">
      <Link
        href={`/order/${code}`}
        className="mx-auto flex min-h-touch max-w-content items-center gap-3 px-4 py-2 text-sm sm:px-6"
      >
        <span aria-hidden className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-success" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-bold">{pick("Η παραγγελία σου", "Your order")}</span>
          <span className="text-stone"> · {label}</span>
        </span>
        <span className="shrink-0 rounded-full bg-success px-3 py-1 text-xs font-bold text-paper">
          {pick("Δες την", "View")} →
        </span>
      </Link>
    </div>
  );
}
