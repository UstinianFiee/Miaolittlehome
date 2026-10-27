import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  FolderIcon,
  UserIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArticleBar } from "@/components/site/article-bar";
import { ArticleToc } from "@/components/site/article-toc";
import { CodeCopy } from "@/components/site/code-copy";
import { DualTime } from "@/components/site/dual-time";
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
import { pickLocalized } from "@/lib/localized";
import { extractMarkdownHeadings, renderMarkdown } from "@/lib/markdown";
import { buildAlternates } from "@/lib/metadata";
import { resizedImageUrl } from "@/lib/image-url";
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
    // 走 notFound()：返回真正的 404 状态码，文案在同级 not-found.tsx 里
    notFound();
  }

  const html = await renderMarkdown(pickLocalized(locale, post.content, post.contentEn));
  const headings = extractMarkdownHeadings(html);
  const commentTree = await listApprovedComments({ type: "post", refId: post.id });
  const commentViews = toCommentViews(commentTree);
  const title = pickLocalized(locale, post.title, post.titleEn);
  const summary = pickLocalized(locale, post.summary, post.summaryEn);
  const isUpdated = post.updatedAt.getTime() - post.createdAt.getTime() > 60_000;
  /*
   * 字数 / 阅读时长：从渲染后的 HTML 去标签统计。
   * 中文按「字」算、英文按「词」算，速度分别取 400 字/分、220 词/分（博客的常用估算）。
   * 只是参考信息，不需要精确；最小显示 1 分钟。
   */
  const plainText = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const isZh = locale.startsWith("zh");
  const wordCount = isZh
    ? Array.from(plainText).length
    : plainText
      ? plainText.split(/\s+/).length
      : 0;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / (isZh ? 400 : 220)));

  return (
    /*
     * `isolate`：文章页的背景层用的是负 z-index，必须包在独立的层叠上下文里，
     * 否则会被外层「内容区背景」那层半透明遮罩盖住（和首页封面同一个坑）。
     */
    <div className="isolate">
      {site.postBackground ? (
        <>
          {/*
            背景图统一走 `/img/1280/...`：这里之前直接用 upload 原图（600KB+），
            和其它背景（站点布局的内容区背景）不一致，也是 1Mbps 下首屏最大的一笔开销。
          */}
          <div
            aria-hidden
            className="fixed inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url("${resizedImageUrl(site.postBackground, 1280)}")` }}
          />
          <div aria-hidden className="page-background-scrim fixed inset-0 -z-10" />
        </>
      ) : null}

      <article className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        {/*
          正文卡片 + 右侧粘性目录。目录放侧边栏，阅读区不再插入额外区块，
          窄屏隐藏目录，正文保持单列；文章进度仍按整张 #article-body 计算。

          2026-10-18 改版：文章封面放在卡片最顶部**通栏大图**，下接标题/正文。
          封面不再缺席，也不再被挤成列表里的小缩略图；同时把阅读面板换成
          更通透的 `.article-panel`（半透明 + 大模糊），在有内容区背景图时
          能透出背景，接近参考站点的"封面 + 玻璃面板"观感。
        */}
        {/*
          注意这里用 `overflow-clip` 而不是 `overflow-hidden`：
          `overflow-hidden` 会创建滚动容器，把右侧目录的 `position: sticky` 废掉
          （目录滚出视口后右栏整块空白）；`overflow-clip` 只裁切、不创建滚动容器，
          封面圆角照样被裁，目录可以正常吸顶。
        */}
        <div id="article-body" className="surface-glass article-panel overflow-clip p-0">
          {post.cover ? (
            <figure className="article-cover">
              {/* 封面是装饰性主图，标题已在下方；alt 留空避免读屏重复 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resizedImageUrl(post.cover, 1280)}
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </figure>
          ) : null}

          <div className="p-5 sm:p-8">
            <div className={`grid items-start gap-8 ${headings.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_15rem]" : ""}`}>
              <div className="min-w-0">
                {/* 标题居中，下面一行是发布时间 / 作者 / 分类 / 浏览，再用分隔线切到正文 */}
                <header className="mb-8 text-center">
                  <h1 className="font-display text-3xl leading-snug text-balance sm:text-4xl">{title}</h1>

                  {summary ? (
                    <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-balance">{summary}</p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3.5 shrink-0" aria-hidden />
                      {t("site.publishedAt")} <DualTime date={post.createdAt} />
                    </span>
                    <span aria-hidden className="hidden opacity-50 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="size-3.5 shrink-0" aria-hidden />
                      {site.author}
                    </span>
                    {isUpdated ? (
                      <>
                        <span aria-hidden className="hidden opacity-50 sm:inline">·</span>
                        <span className="inline-flex items-center gap-1">
                          <ClockIcon className="size-3.5 shrink-0" aria-hidden />
                          {t("site.updatedAt")} <DualTime date={post.updatedAt} />
                        </span>
                      </>
                    ) : null}
                    {post.category ? (
                      <>
                        <span aria-hidden className="hidden opacity-50 sm:inline">·</span>
                        <Link
                          href={`/categories/${post.category.id}`}
                          className="inline-flex items-center gap-1 underline-offset-4 hover:text-primary hover:underline"
                        >
                          <FolderIcon className="size-3.5 shrink-0" aria-hidden />
                          {pickLocalized(locale, post.category.name, post.category.nameEn)}
                        </Link>
                      </>
                    ) : null}
                    <span aria-hidden className="hidden opacity-50 sm:inline">·</span>
                    <ViewCounter slug={post.slug} initialViews={post.views} />
                  </div>

                  {/* 第二行只放字数 / 阅读时长，避免和上面的元信息挤成不规律的两行 */}
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileTextIcon className="size-3 shrink-0" aria-hidden />
                      {t("site.wordCount", { count: wordCount })}
                    </span>
                    <span aria-hidden className="hidden opacity-50 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="size-3 shrink-0" aria-hidden />
                      {t("site.readingTime", { minutes: readingMinutes })}
                    </span>
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

                  <hr className="mt-7 border-0 border-t border-border/70" />
                </header>

                <MarkdownContent html={html} />
                <CodeCopy />
              </div>

              {headings.length > 0 ? (
                <aside className="hidden self-stretch lg:block">
                  {/*
                    top 要落在「固定头部 + 文章导航条」下方：
                    头部约 4.75rem、导航条 top 4.75rem + 高 2.75rem ≈ 7.5rem，
                    取 8.5rem 留一点呼吸；max-height 同步扣掉这部分，避免目录底部被截。
                  */}
                  <div className="sticky top-[8.5rem] max-h-[calc(100dvh-9.5rem)] overflow-y-auto">
                    <ArticleToc headings={headings} title={t("site.articleContents")} />
                  </div>
                </aside>
              ) : null}
            </div>
          </div>
        </div>


      {/* 阅读进度条 + 文章导航栏（滚过标题后出现） */}
      <ArticleBar title={title} />

      <div className="w-full" data-testid="article-comments">
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

          <ShareButton path={`/${locale}/posts/${post.slug}`} />
        </footer>
      </div>
    </article>
    </div>
  );
}
