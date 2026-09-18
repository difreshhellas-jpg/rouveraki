"use client";

import Image from "next/image";
import { tintFor } from "@/lib/photos";
import type { MenuItemDTO } from "@/lib/menu-types";

/**
 * Item photo, with a per-category gradient stand-in until real photography is
 * in place. The stand-in carries the item's initial so a list of them is still
 * scannable, and it keeps the exact aspect ratio a photo will have, so nothing
 * reflows when images land.
 */
export default function ItemThumb({
  item,
  alt,
  sizes = "(max-width: 640px) 33vw, 160px",
  className = "",
  rounded = "rounded-xl",
}: {
  item: MenuItemDTO;
  alt: string;
  sizes?: string;
  className?: string;
  rounded?: string;
}) {
  if (item.image) {
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`}>
        <Image
          src={item.image}
          alt={alt}
          fill
          sizes={sizes}
          loading="lazy"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${rounded} ${className}`}
      style={{ backgroundImage: tintFor(item.category) }}
      role="img"
      aria-label={alt}
    >
      <span
        aria-hidden="true"
        className="font-display text-2xl font-bold text-white/45"
      >
        {alt.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
