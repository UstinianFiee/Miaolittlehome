import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { HOME_PAGE_SIZE, HomeView } from "@/components/site/home-view";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/metadata";
import { listPublishedFeed } from "@/lib/query";

type PagedHomeProps = {
  params: Promise<{ locale: string; page: string }>;
};

/** 最多预生成到第几页（更多页按需生成并缓存，避免文章多时构建产物膨胀）。 */
const PRERENDER_LIMIT = 5;

/** 解析页码；非法值一律按第一页处理。 */
function parsePage(raw: string): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export async function generateStaticParams() {
  // 首页信息流是「文章 + 说说」混排，页数必须按合并后的总数算
  const { total, pageSize } = await listPublishedFeed({ page: 1, pageSize: HOME_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const last = Math.min(totalPages, PRERENDER_LIMIT);

  const params: { locale: string; page: string }[] = [];
  for (const locale of routing.locales) {
    for (let page = 2; page <= last; page += 1) {
      params.push({ locale, page: String(page) });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PagedHomeProps): Promise<Metadata> {
  const { locale, page } = await params;
  return { alternates: buildAlternates(locale, `/page/${parsePage(page)}`) };
}

/** 首页第 2 页起（`/page/2`）。分页走路径段，页面才能被静态预渲染 / ISR 缓存。 */
export default async function PagedHomePage({ params }: PagedHomeProps) {
  const { locale, page: rawPage } = await params;
  setRequestLocale(locale);

  const page = parsePage(rawPage);

  // `/zh/page/1` 不是规范地址，回到首页
  if (page <= 1) {
    redirect(`/${locale}`);
  }

  const { total, pageSize } = await listPublishedFeed({ page: 1, pageSize: HOME_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (page > totalPages) {
    notFound();
  }

  return <HomeView locale={locale} page={page} />;
}
