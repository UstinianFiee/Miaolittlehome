import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArticleBar } from "@/components/site/article-bar";
import { CodeCopy } from "@/components/site/code-copy";
import { MarkdownContent } from "@/components/site/markdown-content";
import { ShareButton } from "@/components/site/share-button";
import { CommentSection } from "@/components/site/comment-section";
import { ViewCounter } from "@/components/site/view-counter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { countCommentViews, toCommentViews } from "@/lib/comment-view";
import { listApprovedComments } from "@/lib/comments";
import { formatDual } from "@/lib/datetime";
import { pickLocalized } from "@/lib/localized";
import { renderMarkdown } from "@/lib/markdown";
import { buildAlternates } from "@/lib/metadata";
import { getPublishedPostBySlug, listPublishedSlugs } from "@/lib/query";
import { getSiteInfo } from "@/lib/settings";

type PostPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/** 静态生成所有已发布文章（按语言）。 */
export async function generateStaticParams() {
  const posts = await listPublishedSlugs();

  return routing.locales.flatMap((locale) =>
    posts.map((post) => ({ locale, slug: post.slug }))
  );
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return {};
  }

  const title = pickLocalized(locale, post.title, post.titleEn);
  const description = pickLocalized(locale, post.summary, post.summaryEn);

  return {
    title,
    description,
    alternates: buildAlternates(locale, `/posts/${slug}`),
    openGraph: {
      title,
      description,
      type: "article",
      ...(post.cover ? { images: [post.cover] } : {}),
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [t, post, site] = await Promise.all([
    getTranslations(),
    getPublishedPostBySlug(slug),
    getSiteInfo(),
  ]);

  if (!post) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-muted-foreground">{t("site.postNotFound")}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/posts">
            <ArrowLeftIcon className="size-4" />
            {t("site.backToPosts")}
          </Link>
        </Button>
      </div>
    );
  }

  const html = await renderMarkdown(pickLocalized(locale, post.content, post.contentEn));
  const commentTree = await listApprovedComments({ type: "post", refId: post.id });
  const commentViews = toCommentViews(commentTree);
  const title = pickLocalized(locale, post.title, post.titleEn);
  const summary = pickLocalized(locale, post.summary, post.summaryEn);
  const isUpdated = post.updatedAt.getTime() - post.createdAt.getTime() > 60_000;

  return (
    /*
     * `isolate`：文章页的背景层用的是负 z-index，必须包在独立的层叠上下文里，
     * 否则会被外层「内容区背景」那层半透明遮罩盖住（和首页封面同一个坑）。
     */
    <div className="isolate">
      {site.postBackground ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url("${site.postBackground}")` }}
          />
          <div aria-hidden className="fixed inset-0 -z-10 bg-background/82" />
        </>
      ) : null}

      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      {/*
        正文包一层玻璃卡：低不透明度 + backdrop-blur，背景图能透出来，
        模糊又把底层抹平，所以文字对比度不会被背景图拉低。
      */}
      <div id="article-body" className="surface-glass p-5 sm:p-8">
      {/* 标题居中，下面一行是发布时间 / 作者 / 分类 / 浏览，再用分隔线切到正文 */}
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl leading-snug text-balance sm:text-4xl">{title}</h1>

        {summary ? (
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-balance">{summary}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <span>
            {t("site.publishedAt")}{" "}
            <time dateTime={post.createdAt.toISOString()}>{formatDual(post.createdAt)}</time>
          </span>
          <span aria-hidden className="opacity-50">
            ·
          </span>
          <span>
            {t("site.author")} {site.author}
          </span>
          {isUpdated ? (
            <>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span>
                {t("site.updatedAt")}{" "}
                <time dateTime={post.updatedAt.toISOString()}>{formatDual(post.updatedAt)}</time>
              </span>
            </>
          ) : null}
          {post.category ? (
            <>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <Link
                href={`/categories/${post.category.id}`}
                className="underline-offset-4 hover:text-primary hover:underline"
              >
                {pickLocalized(locale, post.category.name, post.category.nameEn)}
              </Link>
            </>
          ) : null}
          <span aria-hidden className="opacity-50">
            ·
          </span>
          <ViewCounter slug={post.slug} initialViews={post.views} />
        </div>

        {post.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {post.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/tags/${tag.slug}`}>
                <Badge variant="secondary">{tag.name}</Badge>
              </Link>
            ))}
          </div>
        ) : null}

        {/* 分隔符：把标题区与正文分开 */}
        <hr className="mt-7 border-0 border-t border-border/70" />
      </header>

      <MarkdownContent html={html} />
      {/* 给正文里的代码块挂「复制」按钮（挂载后增强，不参与 hydration） */}
      <CodeCopy />
      </div>

      {/* 阅读进度条 + 文章导航栏（滚过标题后出现） */}
      <ArticleBar title={title} />

      <CommentSection
        scope="post"
        refId={post.id}
        initialComments={commentViews}
        count={countCommentViews(commentViews)}
      />

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/posts">
            <ArrowLeftIcon className="size-4" />
            {t("site.backToPosts")}
          </Link>
        </Button>

        <ShareButton path={`/${locale}/posts/${post.slug}`} title={title} />
      </footer>
    </article>
    </div>
  );
}
