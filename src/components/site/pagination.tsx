import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type SitePaginationProps = {
  /** 去掉语言前缀的路径，例如 "/posts"；首页传空串 */
  basePath: string;
  page: number;
  totalPages: number;
};

/**
 * 分页走**路径段**（`/posts/page/2`）而不是查询参数（`/posts?page=2`）。
 *
 * 原因：页面只要读了 `searchParams`，Next.js 就无法把它预渲染成静态页，
 * 每次访问都要重新 SSR + 查库，响应头会退化成 `no-store`。
 *
 * `scroll={false}`：Next 默认在导航后把页面滚回顶部，而首页顶上是一整屏封面 ——
 * 点「下一页」会被弹回封面，还得再往下拉一次才能看到内容。
 * 关掉自动滚动后停留在原位（封面高度不变，位置正好对得上），
 * 列表页同理（翻页后视线还在原来的高度）。
 */
export async function SitePagination({ basePath, page, totalPages }: SitePaginationProps) {
  const t = await getTranslations();

  if (totalPages <= 1) {
    return null;
  }

  const hrefFor = (target: number) =>
    target <= 1 ? basePath || "/" : `${basePath}/page/${target}`;

  return (
    <nav className="mt-8 flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        {t("site.pageInfo", { page, totalPages })}
      </span>

      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page - 1)} scroll={false}>
              <ChevronLeftIcon className="size-4" />
              {t("site.prevPage")}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeftIcon className="size-4" />
            {t("site.prevPage")}
          </Button>
        )}

        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page + 1)} scroll={false}>
              {t("site.nextPage")}
              <ChevronRightIcon className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t("site.nextPage")}
            <ChevronRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
