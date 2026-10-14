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
 * - **年份升成大字号标题**（站点展示字体 + 主题色微透明），右侧配该年的篇数 ——
 *   扫一眼就知道哪年写得多；
 * - 月份降级成小胶囊，年份之间用一条渐隐横线分隔；
 * - 每行改成「日期 | 标题」两列，日期用等宽数字，纵向能对齐；
 * - 悬停时节点放大转主题色、标题右移并浮出箭头 —— 给静态列表一点可交互的反馈。
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
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
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
                    className="font-display text-4xl leading-none text-primary/85 sm:text-5xl"
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
                      <h3 className="mb-3 inline-flex items-center rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                        {t("site.yearMonth", { year: group.year, month: group.month })}
                      </h3>

                      <ol className="relative ml-1 space-y-1 border-l border-border/70 pl-6">
                        {group.posts.map((post) => (
                          <li key={post.id} className="group relative">
                            <span
                              aria-hidden
                              className="absolute top-4 -left-[1.6rem] size-2 rounded-full bg-border ring-4 ring-primary/0 transition-all duration-300 group-hover:scale-125 group-hover:bg-primary group-hover:ring-primary/15"
                            />
                            <Link
                              href={`/posts/${post.slug}`}
                              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-primary/[0.06]"
                            >
                              <time
                                dateTime={post.createdAt.toISOString()}
                                className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums"
                              >
                                {String(post.createdAt.getUTCDate()).padStart(2, "0")}
                              </time>
                              <span className="min-w-0 flex-1 font-medium underline-offset-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary group-hover:underline">
                                {pickLocalized(locale, post.title, post.titleEn)}
                              </span>
                              <ArrowRightIcon className="size-4 shrink-0 text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
  );
}
