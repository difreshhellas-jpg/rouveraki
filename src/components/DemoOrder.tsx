"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrderTracker, { type TrackedOrder } from "@/components/OrderTracker";
import { getTracked } from "@/lib/demo/store";

/**
 * Demo-mode order page: the order lives in this browser's localStorage, so it is
 * read here after mount instead of on the server. Renders the same tracker.
 */
export default function DemoOrder({ code }: { code: string }) {
  const [order, setOrder] = useState<TrackedOrder | null | undefined>(undefined);

  useEffect(() => {
    setOrder(getTracked(code));
  }, [code]);

  if (order === undefined) {
    return <div className="py-24 text-center text-char/60">…</div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold">404</h1>
        <p className="mt-3 text-char/70">
          Δεν βρέθηκε παραγγελία με αυτόν τον κωδικό. Οι demo παραγγελίες υπάρχουν
          μόνο στον browser όπου έγιναν.
        </p>
        <Link href="/menu" className="btn-primary mt-6">
          Παράγγειλε τώρα
        </Link>
      </div>
    );
  }

  return <OrderTracker initial={order} />;
}
