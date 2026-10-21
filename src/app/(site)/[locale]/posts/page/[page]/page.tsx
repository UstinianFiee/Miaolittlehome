import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { PostsListView } from "@/components/site/posts-list-view";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/metadata";
import { SITE_PAGE_SIZE, countPublishedPosts } from "@/lib/query";

type PagedPostsProps = {
  params: Promise<{ locale: string; page: string }>;
};

/** 最多预生成到第几页（更多页按需生成并缓存）。 */
const PRERENDER_LIMIT = 5;

function parsePage(raw: string): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export async function generateStaticParams() {
  // 只需要总数，用 count 即可，不必执行一次带 findMany 的完整列表查询。
  const total = await countPublishedPosts();
  const totalPages = Math.max(1, Math.ceil(total / SITE_PAGE_SIZE));
  const last = Math.min(totalPages, PRERENDER_LIMIT);

  const params: { locale: string; page: string }[] = [];
  for (const locale of routing.locales) {
    for (let page = 2; page <= last; page += 1) {
      params.push({ locale, page: String(page) });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PagedPostsProps): Promise<Metadata> {
  const { locale, page } = await params;
  const target = parsePage(page);
  return { alternates: buildAlternates(locale, `/posts/page/${target}`) };
}

/** 文章列表第 2 页起（`/posts/page/2`）。 */
export default async function PagedPostsPage({ params }: PagedPostsProps) {
  const { locale, page: rawPage } = await params;
  setRequestLocale(locale);

  const page = parsePage(rawPage);

  // `/zh/posts/page/1` 不是规范地址，回到列表首页
  if (page <= 1) {
    redirect(`/${locale}/posts`);
  }

  // 这里只取总数判断页码是否越界，并把 total 传给列表组件显示，
  // 避免它再为「显示总数」跑一遍列表查询（组件仍需取当页 items）。
  const total = await countPublishedPosts();
  const totalPages = Math.max(1, Math.ceil(total / SITE_PAGE_SIZE));

  if (page > totalPages) {
    notFound();
  }

  return <PostsListView locale={locale} page={page} total={total} />;
}
