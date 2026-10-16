import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PostCardView } from "@/components/site/post-card";
import { routing } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/metadata";
import { getTagBySlug, listPublishedPosts, listTagsWithCount } from "@/lib/query";

type TagPageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const tags = await listTagsWithCount();

  return routing.locales.flatMap((locale) =>
    tags.map((tag) => ({ locale, slug: tag.slug }))
  );
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTagBySlug(slug);

  if (!tag) {
    return {};
  }

  return buildPageMetadata({ locale, path: `/tags/${tag.slug}`, titleKey: "nav.tags" });
}

export default async function TagPage({ params }: TagPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const tag = await getTagBySlug(slug);

  if (!tag) {
    // 走 notFound()：返回真正的 404 状态码，文案在同级 not-found.tsx 里
    notFound();
  }

  const { items, total } = await listPublishedPosts({
    page: 1,
    pageSize: 200,
    tagId: tag.id,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="page-heading mb-4 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl">#{tag.name}</h1>
        <span className="text-sm text-muted-foreground">
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
