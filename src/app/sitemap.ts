import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { routing } from "@/i18n/routing";
import {
  listAlbumsForSite,
  listCategoriesWithCount,
  listPostsForSitemap,
  listTagsWithCount,
} from "@/lib/query";

/** 站点地图：前台所有语言版本的静态页与内容页。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");

  const staticPaths: { path: string; priority: number; changeFrequency: "daily" | "weekly" }[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/posts", priority: 0.9, changeFrequency: "daily" },
    { path: "/archive", priority: 0.6, changeFrequency: "weekly" },
    { path: "/categories", priority: 0.6, changeFrequency: "weekly" },
    { path: "/tags", priority: 0.6, changeFrequency: "weekly" },
    { path: "/albums", priority: 0.5, changeFrequency: "weekly" },
    { path: "/videos", priority: 0.5, changeFrequency: "weekly" },
    { path: "/software", priority: 0.5, changeFrequency: "weekly" },
    { path: "/wall", priority: 0.5, changeFrequency: "weekly" },
    { path: "/about", priority: 0.5, changeFrequency: "weekly" },
  ];

  const [posts, tags, categories, albums] = await Promise.all([
    listPostsForSitemap(),
    listTagsWithCount(),
    listCategoriesWithCount(),
    listAlbumsForSite(),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const item of staticPaths) {
      entries.push({
        url: `${base}/${locale}${item.path}`,
        changeFrequency: item.changeFrequency,
        priority: item.priority,
      });
    }

    for (const post of posts) {
      entries.push({
        url: `${base}/${locale}/posts/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }

    for (const category of categories) {
      entries.push({
        url: `${base}/${locale}/categories/${category.id}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }

    for (const tag of tags) {
      entries.push({
        url: `${base}/${locale}/tags/${tag.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }

    for (const album of albums) {
      entries.push({
        url: `${base}/${locale}/albums/${album.id}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
