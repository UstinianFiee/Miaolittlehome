import { EyeIcon, PinIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DualTime } from "@/components/site/dual-time";
import { ImageSkeleton } from "@/components/site/image-skeleton";
import { Link } from "@/i18n/navigation";
import { resizedImageUrl } from "@/lib/image-url";
import { pickLocalized } from "@/lib/localized";
import type { PostCard } from "@/lib/query";

/**
 * 前台文章卡片：**横向布局**（文字在左、封面在右），保持原有的列表排列方式。
 *
 * 相比早先版本只改一件事：封面从 160×96 的小缩略图**放大到撑满卡片高度**
 * （`self-stretch`，宽 208px），让封面真正成为视觉主体 —— 参考的是
 * Elykia 一类博客里"封面图大幅清晰"的观感，而不是把排列改成竖卡。
 *
 * 封面走 `/img/640/...` 并用 `ImageSkeleton` 垫骨架：`loading="lazy"` 的图片
 * 在滚到可见前会空着一块，骨架把这段空白变成有意义的加载反馈。
 */
export function PostCardView({ post, locale }: { post: PostCard; locale: string }) {
  const t = useTranslations();

  const title = pickLocalized(locale, post.title, post.titleEn);
  const summary = pickLocalized(locale, post.summary, post.summaryEn);

  return (
    <article className="surface lift group mb-5 flex items-stretch gap-4 overflow-hidden p-4 sm:gap-6 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {post.pinned ? (
            <PinIcon
              className="mt-1.5 size-3.5 shrink-0 text-primary"
              aria-label={t("posts.pinned")}
            />
          ) : null}
          <h2
            className="font-display min-w-0 text-lg leading-snug text-balance break-words"
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

        {summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed break-words text-foreground">
            {summary}
          </p>
        ) : null}

        {/* 元信息一行：分类 · 时间 · 阅读量 */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8rem] leading-[1.6] text-muted-foreground">
          {post.category ? (
            <Link
              href={`/categories/${post.category.id}`}
              className="min-w-0 break-words font-medium text-primary transition-opacity hover:opacity-75"
            >
              {pickLocalized(locale, post.category.name, post.category.nameEn)}
            </Link>
          ) : null}
          {post.category ? <span aria-hidden="true">·</span> : null}
          <DualTime date={post.createdAt} />
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

      {/*
        封面：撑满卡片高度（self-stretch），宽度 256px —— 比早先的 160×96 大得多，
        成为卡片的视觉主体（参考 Elykia 一类博客里"封面大幅清晰"的观感）。
        图按 object-cover 裁切，不会变形；没有封面时不预留图位。
      */}
      {post.cover ? (
        <Link
          href={`/posts/${post.slug}`}
          className="w-28 shrink-0 self-stretch overflow-hidden rounded-lg border border-border transition-colors duration-500 group-hover:border-brand/50 sm:w-64"
          tabIndex={-1}
          aria-hidden="true"
        >
          <ImageSkeleton
            src={resizedImageUrl(post.cover, 640)}
            alt=""
            className="h-full w-full"
            imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </Link>
      ) : null}
    </article>
  );
}
