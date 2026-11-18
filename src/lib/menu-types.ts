/** Shape returned by GET /api/menu and consumed by every menu component. */
export type MenuItemDTO = {
  id: number;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  priceCents: number;
  category: string;
  image: string | null;
  available: boolean;
  prepTimeMinutes: number;
  requiresAgeVerification: boolean;
  /** Set only while an offer lowers the price: the normal price, shown crossed out. */
  wasPriceCents?: number;
};
