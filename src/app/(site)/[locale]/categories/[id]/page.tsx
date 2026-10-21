import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PostCardView } from "@/components/site/post-card";
import { routing } from "@/i18n/routing";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { getCategoryById, listCategoriesWithCount, listPublishedPosts } from "@/lib/query";

type CategoryPageProps = { params: Promise<{ locale: string; id: string }> };

export async function generateStaticParams() {
  const categories = await listCategoriesWithCount();

  return routing.locales.flatMap((locale) =>
    categories.map((category) => ({ locale, id: String(category.id) }))
  );
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const category = await getCategoryById(Number(id));

  if (!category) {
    return {};
  }

  return buildPageMetadata({
    locale,
    path: `/categories/${category.id}`,
    titleKey: "nav.categories",
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const categoryId = Number(id);
  const category = Number.isInteger(categoryId) ? await getCategoryById(categoryId) : null;

  if (!category) {
    // 走 notFound()：返回真正的 404 状态码，文案在同级 not-found.tsx 里
    notFound();
  }

  const { items, total } = await listPublishedPosts({
    page: 1,
    pageSize: 200,
    categoryId: category.id,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="page-heading mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display min-w-0 text-2xl break-words">
          {pickLocalized(locale, category.name, category.nameEn)}
        </h1>
        <span className="shrink-0 text-sm text-muted-foreground">
          {t("site.postsCount", { count: total })}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.postsEmpty")}</p>
      ) : (
        <div>
          {items.map((post) => (
            <PostCardView key={post.id} post={post} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
