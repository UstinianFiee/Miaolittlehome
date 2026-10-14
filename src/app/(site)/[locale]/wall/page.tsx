import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { SitePagination } from "@/components/site/pagination";
import { WallView } from "@/components/site/wall-view";
import { toCommentViews } from "@/lib/comment-view";
import { WALL_PAGE_SIZE, listWallComments } from "@/lib/comments";
import { buildPageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/wall", titleKey: "nav.wall" });
}

/** 留言墙首页：最新的一页便利贴（旧的往后翻）。 */
export default async function WallPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { total, items, pageSize } = await listWallComments({ page: 1, pageSize: WALL_PAGE_SIZE });
  const views = toCommentViews(items);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <WallView
        comments={views}
        count={total}
        page={1}
        totalPages={totalPages}
        pagination={
          totalPages > 1 ? (
            <SitePagination basePath="/wall" page={1} totalPages={totalPages} />
          ) : null
        }
      />
    </div>
  );
}
