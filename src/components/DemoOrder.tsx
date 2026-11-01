"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrderTracker, { type TrackedOrder } from "@/components/OrderTracker";
import { apiFetch } from "@/lib/api";

/**
 * Demo-mode order page: the order is read from the shared store (/api/shop)
 * after mount. Renders the same tracker.
 */
export default function DemoOrder({ code }: { code: string }) {
  const [order, setOrder] = useState<TrackedOrder | null | undefined>(undefined);

  useEffect(() => {
    void apiFetch(`/api/orders/${code}`)
      .then((r) => (r.ok ? r.json() : { order: null }))
      .then((d: { order: TrackedOrder | null }) => setOrder(d.order))
      .catch(() => setOrder(null));
  }, [code]);

  if (order === undefined) {
    return <div className="py-24 text-center text-char/60">…</div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold">404</h1>
        <p className="mt-3 text-char/70">
          Δεν βρέθηκε παραγγελία με αυτόν τον κωδικό. Η παρακολούθηση είναι
          διαθέσιμη για παραγγελίες των τελευταίων δύο ημερών.
        </p>
        <Link href="/menu" className="btn-primary mt-6">
          Παράγγειλε τώρα
        </Link>
      </div>
    );
  }

  return <OrderTracker initial={order} />;
}
