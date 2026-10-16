import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Highlight } from "@/components/site/highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { searchAll, type SearchResultType } from "@/lib/search";

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

const TYPE_LABEL_KEYS: Record<SearchResultType, string> = {
  post: "search.typePost",
  album: "search.typeAlbum",
  video: "search.typeVideo",
  software: "search.typeSoftware",
};

export async function generateMetadata({ params }: SearchPageProps): Promise<Metadata> {
  const { locale } = await params;
  const base = await buildPageMetadata({ locale, path: "/search", titleKey: "nav.search" });

  // 搜索结果页不进索引，避免产生大量低价值页面
  return { ...base, robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const t = await getTranslations();
  const outcome = await searchAll(query, locale);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="page-heading">
        <h1 className="font-display text-2xl">{t("search.title")}</h1>
      </div>

      {/* 原生 GET 表单：不依赖 JS 也能提交 */}
      <form action={`/${locale}/search`} method="get" className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder={t("search.placeholder")}
            className="pl-8"
            maxLength={100}
            aria-label={t("search.title")}
          />
        </div>
        <Button type="submit">{t("search.submit")}</Button>
      </form>

      {query.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("search.prompt")}</p>
      ) : outcome.total === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("search.empty", { query })}
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          <p className="text-sm text-muted-foreground">
            {t("search.resultCount", { count: outcome.total })}
          </p>

          {outcome.groups.map((group) => (
            <section key={group.type}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Badge variant="secondary">{t(TYPE_LABEL_KEYS[group.type])}</Badge>
                <span className="text-muted-foreground">
                  {t("search.typeCount", { count: group.hits.length })}
                </span>
              </h2>

              <ul className="divide-y divide-border/60">
                {group.hits.map((hit) => (
                  <li key={`${hit.type}-${hit.id}`} className="py-4">
                    <Link href={hit.href} className="group flex gap-4">
                      {hit.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={hit.cover}
                          alt=""
                          loading="lazy"
                          className="h-16 w-24 shrink-0 rounded border border-border/60 object-cover"
                        />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <p className="font-medium underline-offset-4 group-hover:underline">
                          <Highlight text={hit.title} query={query} />
                        </p>
                        {hit.summary ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            <Highlight text={hit.summary} query={query} />
                          </p>
                        ) : null}
                        {hit.meta ? (
                          <p className="mt-1 text-xs text-muted-foreground">{hit.meta}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
