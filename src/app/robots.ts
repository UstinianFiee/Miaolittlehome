import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** robots.txt：允许抓取前台，屏蔽后台与管理 API。 */
export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
