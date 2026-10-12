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
            <Link href={hrefFor(page - 1)}>
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
            <Link href={hrefFor(page + 1)}>
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
