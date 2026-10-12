import { ChevronDownIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Greeting } from "@/components/site/greeting";
import { HeroBackground } from "@/components/site/hero-background";
import { HeroTitle } from "@/components/site/hero-title";
import { HeroWave } from "@/components/site/hero-wave";
import { SitePagination } from "@/components/site/pagination";
import { PostCardView } from "@/components/site/post-card";
import { Reveal } from "@/components/site/reveal";
import { SiteSidebar } from "@/components/site/site-sidebar";
import { Typewriter } from "@/components/site/typewriter";
import { listPublishedPosts } from "@/lib/query";
import { getSiteInfo } from "@/lib/settings";

/** 首页每页文章数；超出通过分页查看。 */
export const HOME_PAGE_SIZE = 5;

/**
 * 首页内容（封面 + 文章列表 + 侧边栏）。
 *
 * 单独抽出来是因为分页走**路径段**（`/page/2`）而不是查询参数：
 * 一旦页面读取 `searchParams`，Next.js 就没法把它预渲染成静态页，
 * 每次访问都要重新 SSR + 查库（响应头是 `no-store`）。
 * 两个入口（`/[locale]` 与 `/[locale]/page/[page]`）共用这份实现。
 */
export async function HomeView({ locale, page }: { locale: string; page: number }) {
  const t = await getTranslations();
  const { name, subtitle, backgrounds, backgroundVideo, pageBackground } = await getSiteInfo();

  const { items: posts, total, pageSize } = await listPublishedPosts({
    page,
    pageSize: HOME_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      {/*
        首屏封面：背景（视频 / 多图轮播 / 单图）+ 站点名 + 打字机副标题 + 底部波浪。
        `isolate` 不能去掉：封面的背景层用的是负 z-index，若这里不建立独立的层叠上下文，
        它们会跑到外层去和「内容区背景层（z=-20/-10）」混在一起，
        结果内容区那层半透明遮罩会盖在封面图上面，整屏发灰。
      */}
      <section className="hero-shell relative isolate -mt-[5.25rem] flex flex-col items-center justify-center overflow-hidden px-4 text-center sm:-mt-[5.75rem]">
        <HeroBackground images={backgrounds} video={backgroundVideo} />

        <HeroTitle
          text={name}
          className="max-w-4xl text-4xl leading-tight text-balance sm:text-6xl"
        />

        {subtitle ? (
          <p className="hero-subtitle font-display mt-6 text-lg sm:text-2xl">
            <Typewriter text={subtitle} />
          </p>
        ) : null}

        <a
          href="#home-content"
          className="absolute bottom-24 flex flex-col items-center gap-1.5 text-white/70 transition-colors hover:text-white sm:bottom-40"
        >
          <span className="text-[0.7rem] tracking-[0.25em] uppercase">{t("home.scroll")}</span>
          <ChevronDownIcon className="size-4 animate-bounce" />
        </a>

        {/* 底部波浪：填的是内容区背景，与下方无缝衔接 */}
        <HeroWave pageBackground={pageBackground} />
      </section>

      {/* 内容区：左文章列表（分页）+ 右侧栏 */}
      <div id="home-content" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {/* 北京时间问候语：早上好呀 / 中午好呀 / 下午好呀 …（客户端实时计算） */}
            <div className="mb-6">
              <Greeting locale={locale} />
            </div>

            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="section-title font-display text-lg">{t("home.latest")}</h2>
              <span className="text-sm text-muted-foreground">
                {t("site.postsCount", { count: total })}
              </span>
            </div>

            {posts.length === 0 ? (
              <p className="empty-state py-16 text-center text-muted-foreground">{t("site.postsEmpty")}</p>
            ) : (
              <div>
                {posts.map((post, index) => (
                  <Reveal key={post.id} delay={Math.min(index, 5) * 50}>
                    <PostCardView post={post} locale={locale} />
                  </Reveal>
                ))}
              </div>
            )}

            <SitePagination basePath="" page={page} totalPages={totalPages} />
          </div>

          <SiteSidebar locale={locale} />
        </div>
      </div>
    </>
  );
}
