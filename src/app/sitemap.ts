import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-mode";

/** /sitemap.xml: the public pages, for Google Search Console. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: [string, number, "daily" | "weekly" | "yearly"][] = [
    ["", 1, "weekly"],
    ["/menu", 0.9, "daily"],
    ["/legal/allergens", 0.3, "yearly"],
    ["/legal/terms", 0.2, "yearly"],
    ["/legal/privacy", 0.2, "yearly"],
    ["/legal/refunds", 0.2, "yearly"],
    ["/legal/cookies", 0.1, "yearly"],
  ];
  return pages.map(([path, priority, changeFrequency]) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
