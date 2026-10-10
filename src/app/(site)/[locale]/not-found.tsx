"use client";

import { HomeIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** 前台 404：语言路由下未匹配的路径都落到这里。 */
export default function LocaleNotFound() {
  const t = useTranslations();

  return (
    <div className="mx-auto flex min-h-[62vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p
        className="font-display text-7xl leading-none sm:text-9xl"
        style={{ color: "color-mix(in oklab, var(--primary) 35%, transparent)" }}
      >
        404
      </p>

      <h1 className="font-display mt-5 text-2xl">{t("notFound.title")}</h1>

      <p className="mt-3 max-w-md text-muted-foreground">{t("notFound.description")}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">
            <HomeIcon className="size-4" />
            {t("notFound.backHome")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/posts">
            <SearchIcon className="size-4" />
            {t("notFound.browsePosts")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
