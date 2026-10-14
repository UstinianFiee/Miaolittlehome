import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { SitePagination } from "@/components/site/pagination";
import { WallView } from "@/components/site/wall-view";
import { routing } from "@/i18n/routing";
import { toCommentViews } from "@/lib/comment-view";
import { WALL_PAGE_SIZE, listWallComments } from "@/lib/comments";
import { buildAlternates } from "@/lib/metadata";

type PagedWallProps = { params: Promise<{ locale: string; page: string }> };

/** 最多预生成到第几页（留言更多时按需生成并缓存）。 */
const PRERENDER_LIMIT = 3;

function parsePage(raw: string): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export async function generateStaticParams() {
  const { total, pageSize } = await listWallComments({ page: 1, pageSize: WALL_PAGE_SIZE });
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

export async function generateMetadata({ params }: PagedWallProps): Promise<Metadata> {
  const { locale, page } = await params;
  return { alternates: buildAlternates(locale, `/wall/page/${parsePage(page)}`) };
}

/** 留言墙第 2 页起（`/wall/page/2`）。 */
export default async function PagedWallPage({ params }: PagedWallProps) {
  const { locale, page: rawPage } = await params;
  setRequestLocale(locale);

  const page = parsePage(rawPage);

  // `/zh/wall/page/1` 不是规范地址，回到墙首页
  if (page <= 1) {
    redirect(`/${locale}/wall`);
  }

  const { total, items, pageSize } = await listWallComments({ page, pageSize: WALL_PAGE_SIZE });

  // total 只统计顶层留言；回复多的一页不会让页数算错
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) {
    notFound();
  }

  const views = toCommentViews(items);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <WallView
        comments={views}
        count={total}
        page={page}
        totalPages={totalPages}
        pagination={<SitePagination basePath="/wall" page={page} totalPages={totalPages} />}
      />
    </div>
  );
}
