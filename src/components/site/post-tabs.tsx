"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/localized";
import { cn } from "@/lib/utils";

export type SidebarPost = {
  id: number;
  title: string;
  titleEn: string | null;
  slug: string;
  views: number;
};

/** 侧边栏「最新文章 / 热点文章」标签页。 */
export function PostTabs({
  recent,
  popular,
  locale,
}: {
  recent: SidebarPost[];
  popular: SidebarPost[];
  locale: string;
}) {
  const t = useTranslations();
  const [tab, setTab] = React.useState<"recent" | "popular">("recent");

  const list = tab === "recent" ? recent : popular;

  const tabs = [
    { key: "recent" as const, label: t("sidebar.recent") },
    { key: "popular" as const, label: t("sidebar.hot") },
  ];

  return (
    <div className="surface overflow-hidden">
      <div className="flex border-b border-border/60">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "flex-1 px-4 py-3 text-sm transition-colors",
              tab === item.key
                ? "border-b-2 border-brand font-medium text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul className="p-2">
        {list.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">{t("sidebar.noPosts")}</li>
        ) : (
          list.map((post) => (
            <li key={post.id}>
              <Link
                href={`/posts/${post.slug}`}
                className="flex min-w-0 items-start gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-accent/40 hover:text-primary"
              >
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                <span className="min-w-0 line-clamp-2 break-words">{pickLocalized(locale, post.title, post.titleEn)}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
