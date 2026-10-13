import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { listTagsWithCount } from "@/lib/query";

type TagsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: TagsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/tags", titleKey: "nav.tags" });
}

/** 书签的 primary 占比：同一色系里循环，避免雷同又不引入杂色 */
const MIXES = ["12%", "18%", "24%", "14%", "20%"] as const;

export default async function TagsPage({ params }: TagsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const tags = await listTagsWithCount();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">{t("site.tagsTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("site.tagsHint")}</p>

      {tags.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.tagsEmpty")}</p>
      ) : (
        <div className="mt-8">
          {/* 一根横杆，标签像书签一样挂在上面 */}
          <div aria-hidden className="h-px w-full bg-border/70" />
          <div className="flex flex-wrap items-start gap-x-2 gap-y-5">
            {tags.map((tag, index) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="bookmark group inline-flex min-w-[4.5rem] items-baseline gap-2 rounded-t-md px-3.5 pt-3 pb-5 font-display text-sm"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--primary) ${MIXES[index % MIXES.length]}, var(--card))`,
                }}
              >
                <span className="transition-colors group-hover:text-primary">{tag.name}</span>
                <span className="text-[0.7rem] font-normal tabular-nums text-muted-foreground">
                  {tag._count.posts}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
