import type { Prisma } from "@prisma/client";

/**
 * Columns the customer tracking page and its API are allowed to read.
 *
 * Deliberately its own module rather than living in order-service: pages import
 * this, and order-service pulls in the payment providers, SMS and realtime.
 * A page that only needs a Prisma select should not drag that whole tree with
 * it into the bundler's module graph.
 *
 * No phone, no address, no other customer's data.
 */
export const publicOrderShape = {
  orderCode: true,
  status: true,
  fulfillmentType: true,
  etaMinutes: true,
  etaConfirmedAt: true,
  items: true,
  subtotalAmount: true,
  deliveryFee: true,
  totalAmount: true,
  paymentMethod: true,
  customerName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;
