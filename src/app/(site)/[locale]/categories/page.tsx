import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listCategoriesWithCount } from "@/lib/query";

type CategoriesPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CategoriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/categories", titleKey: "nav.categories" });
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const categories = await listCategoriesWithCount();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">{t("site.categoriesTitle")}</h1>

      {categories.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.categoriesEmpty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-border/60">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-4 py-4">
              <Link
                href={`/categories/${category.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {pickLocalized(locale, category.name, category.nameEn)}
              </Link>
              <Badge variant="secondary">
                {t("site.postsCount", { count: category._count.posts })}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
