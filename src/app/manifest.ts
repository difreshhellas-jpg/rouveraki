import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Lets customers install the site from the browser ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.nameEl} · Ξυλόκαστρο`,
    short_name: BRAND.nameEl,
    description: "Παραγγελία online από το Ρουβεράκι, στη μαρίνα του Ξυλοκάστρου.",
    lang: "el",
    start_url: "/menu",
    scope: "/",
    display: "standalone",
    background_color: "#f6efe6",
    theme_color: "#a16207",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
