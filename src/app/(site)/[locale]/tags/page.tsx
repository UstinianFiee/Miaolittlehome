import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { listTagsWithCount } from "@/lib/query";

type TagsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: TagsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/tags", titleKey: "nav.tags" });
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const tags = await listTagsWithCount();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">{t("site.tagsTitle")}</h1>

      {tags.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.tagsEmpty")}</p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link key={tag.id} href={`/tags/${tag.slug}`}>
              <Badge variant="secondary" className="px-3 py-1 text-sm">
                {tag.name}
                <span className="ml-1.5 text-muted-foreground">{tag._count.posts}</span>
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
