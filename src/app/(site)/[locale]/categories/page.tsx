import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listCategoriesWithCount } from "@/lib/query";

type CategoriesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CategoriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/categories", titleKey: "nav.categories" });
}

/** 书签的 primary 占比：同一色系里循环，避免雷同又不引入杂色 */
const MIXES = ["10%", "16%", "22%", "13%", "19%"] as const;

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const categories = await listCategoriesWithCount();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="page-heading">
        <h1 className="font-display text-2xl">{t("site.categoriesTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("site.categoriesHint")}</p>
      </div>

      {categories.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.categoriesEmpty")}</p>
      ) : (
        <div className="mt-8">
          {/* 一根横杆，书签挂在上面 */}
          <div aria-hidden className="h-px w-full bg-border/70" />
          <div className="flex flex-wrap items-start gap-x-2 gap-y-5">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/categories/${category.id}`}
                className="bookmark group inline-flex min-w-[6rem] flex-col items-start rounded-t-md px-3.5 pt-3 pb-5 text-left font-display text-sm"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--primary) ${MIXES[index % MIXES.length]}, var(--card))`,
                }}
              >
                <span className="transition-colors group-hover:text-primary">
                  {pickLocalized(locale, category.name, category.nameEn)}
                </span>
                <span className="mt-0.5 text-[0.7rem] font-normal text-muted-foreground">
                  {t("site.postsCount", { count: category._count.posts })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
