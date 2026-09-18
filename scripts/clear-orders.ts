/**
 * Wipes order data so a test session starts from an empty queue.
 *
 * Deletes orders, their history, payments, refunds, customers and the webhook
 * ledger. Leaves the menu alone — reseeding that is `npm run seed`.
 *
 *   npm run db:clear-orders
 *
 * Refuses to run against anything that is not an obviously local database,
 * because "clear all orders" pointed at Supabase is not recoverable.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

if (!isLocal) {
  console.error(
    "Refusing to run: DATABASE_URL does not point at localhost.\n" +
      "This deletes every order. If you really mean to clear a remote " +
      "database, do it deliberately from the database console.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  // Children first — the cascades would handle it, but being explicit makes
  // the counts meaningful.
  const history = await prisma.orderStatusHistory.deleteMany();
  const payments = await prisma.payment.deleteMany();
  const refunds = await prisma.refund.deleteMany();
  const orders = await prisma.order.deleteMany();
  const customers = await prisma.customer.deleteMany();
  const webhooks = await prisma.webhookEvent.deleteMany();

  console.log(
    `Cleared: ${orders.count} orders, ${history.count} history rows, ` +
      `${payments.count} payments, ${refunds.count} refunds, ` +
      `${customers.count} customers, ${webhooks.count} webhook events.`,
  );
  console.log("Menu left untouched.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
