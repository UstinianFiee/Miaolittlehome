import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listArchive } from "@/lib/query";

type ArchivePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ArchivePageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/archive", titleKey: "nav.archive" });
}

/**
 * 归档页：时间线。
 *
 * 原来是「月份小标题 + 竖线 + 小圆点」，信息层级太平，一屏扫下来抓不住重点。
 * 改造思路：
 * - **年份升成大字号标题**（站点展示字体 + 实色主题色），右侧配该年的篇数 ——
 *   扫一眼就知道哪年写得多；
 * - 月份降级成小胶囊，年份之间用一条渐隐横线分隔；
 * - 每行改成「日期 | 标题」两列，日期用等宽数字，纵向能对齐；
 * - 整体放在实色面板中，节点与日期保持可读，悬停/键盘聚焦用主题浅底反馈。
 */
export default async function ArchivePage({ params }: ArchivePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const groups = await listArchive();

  // 按年分包，年份标题只渲染一次
  const years = new Map<number, typeof groups>();
  for (const group of groups) {
    const list = years.get(group.year) ?? [];
    list.push(group);
    years.set(group.year, list);
  }

  const totalPosts = groups.reduce((sum, group) => sum + group.posts.length, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="surface archive-panel p-5 sm:p-9">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl">{t("site.archiveTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("site.archiveHint")}</p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("site.postsCount", { count: totalPosts })}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="empty-state mt-8 rounded-lg border border-dashed border-border/70 py-16 text-center text-sm text-muted-foreground">
          {t("site.archiveEmpty")}
        </p>
      ) : (
        <div className="mt-10 space-y-12">
          {[...years.entries()].map(([year, monthGroups]) => {
            const yearCount = monthGroups.reduce((sum, group) => sum + group.posts.length, 0);

            return (
              <section key={year}>
                {/* 年份标题 + 渐隐分隔线 */}
                <div className="flex items-center gap-4">
                  <h2
                    className="font-display text-4xl leading-none text-primary sm:text-5xl"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {year}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {t("site.postsCount", { count: yearCount })}
                  </span>
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent"
                  />
                </div>

                <div className="mt-6 space-y-8">
                  {monthGroups.map((group) => (
                    <div key={group.key}>
                      <h3 className="mb-3 inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        {t("site.yearMonth", { year: group.year, month: group.month })}
                      </h3>

                      <ol className="relative ml-1 space-y-1 border-l border-brand/35 pl-4 sm:pl-6">
                        {group.posts.map((post) => (
                          <li key={post.id} className="group relative">
                            <span
                              aria-hidden
                              className="absolute top-5 -left-[1.275rem] size-2 rounded-full bg-brand ring-4 ring-card transition-shadow duration-200 group-hover:ring-brand/20 sm:-left-[1.775rem]"
                            />
                            <Link
                              href={`/posts/${post.slug}`}
                              className="archive-entry flex items-baseline gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-4"
                            >
                              <time
                                dateTime={post.createdAt.toISOString()}
                                className="w-6 shrink-0 text-sm font-medium text-muted-foreground tabular-nums sm:w-9"
                              >
                                {String(post.createdAt.getUTCDate()).padStart(2, "0")}
                              </time>
                              <span className="min-w-0 flex-1 break-words font-medium text-card-foreground underline-offset-4 group-hover:text-primary group-hover:underline">
                                {pickLocalized(locale, post.title, post.titleEn)}
                              </span>
                              <ArrowRightIcon className="size-4 shrink-0 self-center text-muted-foreground transition-colors group-hover:text-primary" />
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
