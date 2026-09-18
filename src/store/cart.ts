"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DELIVERY_ZONES, zoneById } from "@/lib/brand";

export type CartLine = {
  /** Stable per-line key: the same dish with different notes is a separate line. */
  lineId: string;
  menuItemId: number;
  name: string;
  nameEn?: string | null;
  unitPriceCents: number;
  quantity: number;
  itemNotes: string;
  requiresAgeVerification: boolean;
  image?: string | null;
  category: string;
};

export type FulfillmentType = "delivery" | "pickup";

type CartState = {
  lines: CartLine[];
  fulfillmentType: FulfillmentType;
  zoneId: string | null;
  /** Bumped on every add so the floating bar can animate without prop drilling. */
  lastAddedAt: number;

  addLine: (
    input: Omit<CartLine, "lineId" | "quantity"> & { quantity?: number },
  ) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  setNotes: (lineId: string, notes: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  setFulfillment: (t: FulfillmentType) => void;
  setZone: (id: string | null) => void;
};

const MAX_QTY_PER_LINE = 30;

/** Notes are part of the identity of a line, so "no onion" never merges into "extra onion". */
const makeLineId = (menuItemId: number, notes: string) =>
  `${menuItemId}::${notes.trim().toLowerCase()}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      fulfillmentType: "delivery",
      zoneId: null,
      lastAddedAt: 0,

      addLine: (input) =>
        set((state) => {
          const quantity = Math.min(
            MAX_QTY_PER_LINE,
            Math.max(1, input.quantity ?? 1),
          );
          const lineId = makeLineId(input.menuItemId, input.itemNotes);
          const existing = state.lines.find((l) => l.lineId === lineId);
          const lines = existing
            ? state.lines.map((l) =>
                l.lineId === lineId
                  ? {
                      ...l,
                      quantity: Math.min(MAX_QTY_PER_LINE, l.quantity + quantity),
                    }
                  : l,
              )
            : [...state.lines, { ...input, quantity, lineId }];
          return { lines, lastAddedAt: Date.now() };
        }),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) =>
                  l.lineId === lineId
                    ? { ...l, quantity: Math.min(MAX_QTY_PER_LINE, quantity) }
                    : l,
                ),
        })),

      setNotes: (lineId, notes) =>
        set((state) => {
          const target = state.lines.find((l) => l.lineId === lineId);
          if (!target) return state;
          const nextId = makeLineId(target.menuItemId, notes);
          // Editing notes can collide with an existing line — merge instead of
          // creating a duplicate key.
          const collision = state.lines.find(
            (l) => l.lineId === nextId && l.lineId !== lineId,
          );
          if (collision) {
            return {
              lines: state.lines
                .filter((l) => l.lineId !== lineId)
                .map((l) =>
                  l.lineId === nextId
                    ? {
                        ...l,
                        quantity: Math.min(
                          MAX_QTY_PER_LINE,
                          l.quantity + target.quantity,
                        ),
                      }
                    : l,
                ),
            };
          }
          return {
            lines: state.lines.map((l) =>
              l.lineId === lineId ? { ...l, itemNotes: notes, lineId: nextId } : l,
            ),
          };
        }),

      removeLine: (lineId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      clear: () => set({ lines: [], lastAddedAt: 0 }),

      setFulfillment: (fulfillmentType) =>
        set((state) => ({
          fulfillmentType,
          // Pickup has no zone; drop a stale selection rather than carrying it.
          zoneId: fulfillmentType === "pickup" ? null : state.zoneId,
        })),

      setZone: (zoneId) => set({ zoneId }),
    }),
    {
      name: "rouveraki.cart.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lines: s.lines,
        fulfillmentType: s.fulfillmentType,
        zoneId: s.zoneId,
      }),
      version: 1,
    },
  ),
);

/* ---- derived selectors (pure, used by components and by checkout) -------- */

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.quantity, 0);

export const cartSubtotalCents = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);

export const cartHasAgeGated = (lines: CartLine[]) =>
  lines.some((l) => l.requiresAgeVerification);

export const deliveryFeeCents = (
  fulfillment: FulfillmentType,
  zoneId: string | null,
) => {
  if (fulfillment === "pickup" || !zoneId) return 0;
  return Math.round((zoneById(zoneId)?.deliveryFee ?? 0) * 100);
};

export const zoneMinimumCents = (
  fulfillment: FulfillmentType,
  zoneId: string | null,
) => {
  if (fulfillment === "pickup" || !zoneId) return 0;
  return Math.round((zoneById(zoneId)?.minimumOrder ?? 0) * 100);
};

export const cartTotals = (
  lines: CartLine[],
  fulfillment: FulfillmentType,
  zoneId: string | null,
) => {
  const subtotal = cartSubtotalCents(lines);
  const fee = deliveryFeeCents(fulfillment, zoneId);
  const minimum = zoneMinimumCents(fulfillment, zoneId);
  return {
    subtotalCents: subtotal,
    deliveryFeeCents: fee,
    totalCents: subtotal + fee,
    minimumCents: minimum,
    meetsMinimum: subtotal >= minimum,
    shortfallCents: Math.max(0, minimum - subtotal),
  };
};

export const ALL_ZONES = DELIVERY_ZONES;
