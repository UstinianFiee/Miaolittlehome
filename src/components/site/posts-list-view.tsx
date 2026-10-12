import { getTranslations } from "next-intl/server";

import { Greeting } from "@/components/site/greeting";
import { SitePagination } from "@/components/site/pagination";
import { PostCardView } from "@/components/site/post-card";
import { Reveal } from "@/components/site/reveal";
import { SiteSidebar } from "@/components/site/site-sidebar";
import { listPublishedPosts } from "@/lib/query";

/**
 * 文章列表内容（分页走路径段 `/posts/page/N`）。
 *
 * 与首页同理：页面一旦读 `searchParams` 就无法静态预渲染，所以分页参数
 * 放在路径里。`/[locale]/posts` 与 `/[locale]/posts/page/[page]` 共用这份实现。
 */
export async function PostsListView({ locale, page }: { locale: string; page: number }) {
  const { items, total, pageSize } = await listPublishedPosts({ page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const t = await getTranslations();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {/* 北京时间问候语：早上好呀 / 中午好呀 / 下午好呀 …（客户端实时计算） */}
          <div className="mb-6">
            <Greeting locale={locale} />
          </div>

          <header className="mb-6 flex items-baseline justify-between gap-4">
            <h1 className="font-display text-2xl">{t("site.postsTitle")}</h1>
            <span className="text-sm text-muted-foreground">
              {t("site.postsCount", { count: total })}
            </span>
          </header>

          {items.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">{t("site.postsEmpty")}</p>
          ) : (
            <div>
              {items.map((post, index) => (
                <Reveal key={post.id} delay={Math.min(index, 5) * 50}>
                  <PostCardView post={post} locale={locale} />
                </Reveal>
              ))}
            </div>
          )}

          <SitePagination basePath="/posts" page={page} totalPages={totalPages} />
        </div>

        <SiteSidebar locale={locale} />
      </div>
    </div>
  );
}
