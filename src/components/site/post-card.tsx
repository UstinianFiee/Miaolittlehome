import { EyeIcon, PinIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatDual } from "@/lib/datetime";
import { pickLocalized } from "@/lib/localized";
import type { PostCard } from "@/lib/query";

/** 前台文章卡片。封面用原生 img：生产环境由 Nginx 直出已优化的图片。 */
export function PostCardView({ post, locale }: { post: PostCard; locale: string }) {
  const t = useTranslations();

  const title = pickLocalized(locale, post.title, post.titleEn);
  const summary = pickLocalized(locale, post.summary, post.summaryEn);

  return (
    <article className="surface lift group mb-4 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        {post.cover ? (
          <Link
            href={`/posts/${post.slug}`}
            className="shrink-0 overflow-hidden rounded border border-border sm:order-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover}
              alt=""
              loading="lazy"
              className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.05] sm:h-24 sm:w-40"
            />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {post.pinned ? (
              <PinIcon
                className="mt-1.5 size-3.5 shrink-0 text-primary"
                aria-label={t("posts.pinned")}
              />
            ) : null}
            <h2
              className="font-display text-lg leading-snug"
              style={{ color: "var(--card-foreground)" }}
            >
              <Link
                href={`/posts/${post.slug}`}
                className="link-underline transition-colors hover:text-primary"
              >
                {title}
              </Link>
            </h2>
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <time dateTime={post.createdAt.toISOString()}>{formatDual(post.createdAt)}</time>
            {post.category ? (
              <span>
                ·{" "}
                <Link
                  href={`/categories/${post.category.id}`}
                  className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {pickLocalized(locale, post.category.name, post.category.nameEn)}
                </Link>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="size-3.5" />
              {post.views}
            </span>
          </div>

          {post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map(({ tag }) => (
                <Link key={tag.id} href={`/tags/${tag.slug}`} className="tag-pill">
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
