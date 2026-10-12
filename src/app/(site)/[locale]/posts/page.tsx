import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { PostsListView } from "@/components/site/posts-list-view";
import { buildPageMetadata } from "@/lib/metadata";

type PostsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PostsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/posts", titleKey: "nav.posts" });
}

/**
 * 文章列表第一页。
 *
 * 刻意不读 `searchParams`：读取后页面会退化成每次请求都重新 SSR + 查库。
 * 分页走路径段，见 ./page/[page]/page.tsx。
 */
export default async function PostsPage({ params }: PostsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PostsListView locale={locale} page={1} />;
}
