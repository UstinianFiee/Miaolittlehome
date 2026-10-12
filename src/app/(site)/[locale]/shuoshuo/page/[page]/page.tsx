import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { ShuoshuoListView } from "@/components/site/shuoshuo-list-view";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/metadata";
import { SHUOSHUO_PAGE_SIZE, listPublishedShuoshuo } from "@/lib/shuoshuo";

type PagedShuoshuoProps = {
  params: Promise<{ locale: string; page: string }>;
};

/** 最多预生成到第几页（更多页按需生成并缓存）。 */
const PRERENDER_LIMIT = 5;

function parsePage(raw: string): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export async function generateStaticParams() {
  const { total, pageSize } = await listPublishedShuoshuo({ page: 1, pageSize: SHUOSHUO_PAGE_SIZE });
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

export async function generateMetadata({ params }: PagedShuoshuoProps): Promise<Metadata> {
  const { locale, page } = await params;
  return { alternates: buildAlternates(locale, `/shuoshuo/page/${parsePage(page)}`) };
}

/** 说说列表第 2 页起（`/shuoshuo/page/2`）。 */
export default async function PagedShuoshuoPage({ params }: PagedShuoshuoProps) {
  const { locale, page: rawPage } = await params;
  setRequestLocale(locale);

  const page = parsePage(rawPage);

  // `/zh/shuoshuo/page/1` 不是规范地址，回到列表首页
  if (page <= 1) {
    redirect(`/${locale}/shuoshuo`);
  }

  const { total, pageSize } = await listPublishedShuoshuo({ page: 1, pageSize: SHUOSHUO_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (page > totalPages) {
    notFound();
  }

  return <ShuoshuoListView locale={locale} page={page} />;
}
