import type { MetadataRoute } from "next";
import { IS_TEST_DEPLOY, siteUrl } from "@/lib/site-mode";

/** /robots.txt. Test deploys stay out of search; the real shop lists its public pages. */
export default function robots(): MetadataRoute.Robots {
  if (IS_TEST_DEPLOY) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Staff screens, the API and per-customer pages have nothing to rank.
        disallow: ["/admin", "/demo-kitchen", "/api/", "/checkout", "/order/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
