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
};
