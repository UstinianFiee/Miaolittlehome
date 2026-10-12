import { getTranslations } from "next-intl/server";

import { SitePagination } from "@/components/site/pagination";
import { Reveal } from "@/components/site/reveal";
import { ShuoshuoCard } from "@/components/site/shuoshuo-card";
import { listPublishedShuoshuo } from "@/lib/shuoshuo";
import { getSiteInfo } from "@/lib/settings";

/**
 * 说说列表（独立页）。
 *
 * 和首页一样用**路径段分页**（`/shuoshuo/page/2`）而不是 `?page=`：
 * 一旦读 `searchParams`，Next.js 就没法把它预渲染成静态页。
 * 两个入口（`/shuoshuo` 与 `/shuoshuo/page/[page]`）共用这份实现。
 */
export async function ShuoshuoListView({ locale, page }: { locale: string; page: number }) {
  const t = await getTranslations();
  const site = await getSiteInfo();

  const { items, total, pageSize } = await listPublishedShuoshuo({ page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">{t("shuoshuo.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("shuoshuo.subtitle")}</p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {t("shuoshuo.count", { count: total })}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="empty-state py-16 text-center text-muted-foreground">
          {t("shuoshuo.empty")}
        </p>
      ) : (
        <div>
          {items.map((item, index) => (
            <Reveal key={item.id} delay={Math.min(index, 5) * 50}>
              <ShuoshuoCard item={item} locale={locale} siteName={site.name} logo={site.logo} />
            </Reveal>
          ))}
        </div>
      )}

      <SitePagination basePath="/shuoshuo" page={page} totalPages={totalPages} />
    </div>
  );
}
