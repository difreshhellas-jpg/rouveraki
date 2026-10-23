import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/demo/config";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Επιστροφή από την πληρωμή",
  robots: { index: false, follow: false },
};

/**
 * Where Viva sends the customer back to after the payment page.
 *
 * Set BOTH the success and failure URLs in the Viva dashboard to
 * https://<site>/checkout/return — Viva appends ?t=<transactionId>&s=<orderCode>.
 *
 * This page only *navigates*. It never marks an order paid: the browser can be
 * closed, the URL can be edited, and a customer who never lands here has still
 * paid. The webhook is what moves money-dependent state, and it verifies with
 * Viva directly. Here we just find the order and show it.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Demo payments never leave the site, so there is nothing to return from.
  if (DEMO_MODE) redirect("/menu");

  const { prisma } = await import("@/lib/prisma");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const transactionId = one(sp.t);
  const vivaOrderCode = one(sp.s);

  const payment =
    transactionId || vivaOrderCode
      ? await prisma.payment.findFirst({
          where: {
            OR: [
              ...(transactionId ? [{ vivaTransactionId: transactionId }] : []),
              ...(vivaOrderCode ? [{ vivaOrderCode }] : []),
            ],
          },
          select: { order: { select: { orderCode: true } } },
          orderBy: { createdAt: "desc" },
        })
      : null;

  if (payment?.order?.orderCode) {
    redirect(`/order/${payment.order.orderCode}`);
  }

  // No match: usually a stale link or a payment abandoned before Viva created
  // the transaction. Say so plainly rather than implying anything about money.
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl font-bold">
        Δεν βρήκαμε την παραγγελία
      </h1>
      <p className="mt-3 text-char/70">
        Αν ολοκλήρωσες την πληρωμή, θα λάβεις SMS με τον κωδικό της παραγγελίας
        σου. Αν όχι, δοκίμασε ξανά ή τηλεφώνησέ μας.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={`tel:${BRAND.phone.tel}`} className="btn-secondary">
          {BRAND.phone.display}
        </a>
        <Link href="/menu" className="btn-primary">
          Πίσω στο μενού
        </Link>
      </div>
    </div>
  );
}
