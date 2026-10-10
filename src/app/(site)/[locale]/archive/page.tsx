import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { formatDual } from "@/lib/datetime";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listArchive } from "@/lib/query";

type ArchivePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ArchivePageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/archive", titleKey: "nav.archive" });
}

/** 归档 + 时间线：按年月分组，左侧竖线与节点即为时间线形态。 */
export default async function ArchivePage({ params }: ArchivePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const groups = await listArchive();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">{t("site.archiveTitle")}</h1>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.archiveEmpty")}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground">
                {t("site.yearMonth", { year: group.year, month: group.month })}
              </h2>

              <ol className="relative space-y-1 border-l border-border/70 pl-6">
                {group.posts.map((post) => (
                  <li key={post.id} className="relative py-2">
                    <span
                      aria-hidden
                      className="absolute top-4 -left-[1.6rem] size-2 rounded-full bg-primary ring-4 ring-primary/15"
                    />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link
                        href={`/posts/${post.slug}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {pickLocalized(locale, post.title, post.titleEn)}
                      </Link>
                      <time
                        dateTime={post.createdAt.toISOString()}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {formatDual(post.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
