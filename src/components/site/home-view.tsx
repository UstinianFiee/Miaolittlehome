import { getTranslations } from "next-intl/server";
import ReactDOM from "react-dom";

import { Greeting } from "@/components/site/greeting";
import { HeroBackground } from "@/components/site/hero-background";
import { HeroIntro } from "@/components/site/hero-intro";
import { HeroWaves } from "@/components/site/hero-waves";
import { SitePagination } from "@/components/site/pagination";
import { PostCardView } from "@/components/site/post-card";
import { Reveal } from "@/components/site/reveal";
import { ShuoshuoCard } from "@/components/site/shuoshuo-card";
import { SiteSidebar } from "@/components/site/site-sidebar";
import { resizedImageUrl } from "@/lib/image-url";
import { pickLocalized } from "@/lib/localized";
import { listPublishedFeed } from "@/lib/query";
import { getProfile, getSiteInfo } from "@/lib/settings";

/** 首页每页条数（文章 + 说说合计）；超出通过分页查看。 */
export const HOME_PAGE_SIZE = 5;

/**
 * 首页内容（封面 + 文章列表 + 侧边栏）。
 *
 * 单独抽出来是因为分页走**路径段**（`/page/2`）而不是查询参数：
 * 一旦页面读取 `searchParams`，Next.js 就没法把它预渲染成静态页，
 * 每次访问都要重新 SSR + 查库（响应头是 `no-store`）。
 * 两个入口（`/[locale]` 与 `/[locale]/page/[page]`）共用这份实现。
 *
 * `total` 由分页页算好后传进来（它本来就要用 count 判断页码是否越界），
 * 这样这里只需要为「取当前页条目」跑一次信息流查询，不必为了显示总数再查一遍。
 */
export async function HomeView({
  locale,
  page,
  total: totalProp,
}: {
  locale: string;
  page: number;
  total?: number;
}) {
  const t = await getTranslations();
  const [site, profile] = await Promise.all([getSiteInfo(), getProfile()]);
  const { name, subtitle, subtitleEn, description, backgrounds, backgroundVideo } = site;
  /*
   * 封面副标题：/en 优先英文副标题（site.subtitleEn），留空回退中文副标题——
   * 与文章 titleEn / contentEn 的回退规则一致；两者都没有再回退站点描述 / 个人简介，
   * 避免「设置里只填了描述」的站点首屏只剩一个孤零零的站名（用户反馈过）。
   */
  const heroSubtitle =
    pickLocalized(locale, subtitle, subtitleEn) || description || profile.bio;
  /*
   * 说说气泡的署名用**作者名**，不是站点名：
   * 个人资料名 → 站点作者 → 站点名 逐级兜底（都为空时至少不空着）。
   */
  const authorName = profile.name || site.author || name;

  /*
   * 封面背景图走 `/img/1280/...`：
   * - 上传原图常有 600KB+，1280 宽的 webp 通常只有几十 KB；
   * - 这是 1Mbps 小水管的站点，1920 档在手机（约 390px 宽）属于纯浪费，
   *   桌面 1280 也足够覆盖首屏；
   * - 再显式 preload 一次 —— 背景图是 CSS `background-image`，浏览器要等 CSSOM
   *   建好才发现它，preload 能把它提到最前面开始下载（首屏最明显的一处延迟）。
   *
   * 注意：`HeroBackground` 用的是 CSS `background-image`，只能吃单个 URL，
   * 没法像 `<img srcSet>` 那样按视口在 640/1280/1920 之间挑；要完全按屏选档
   * 需要把 HeroBackground 改成 `<img>` + `srcSet`（本次不改那个文件）。
   */
  const heroImages = backgrounds.map((src) => resizedImageUrl(src, 1280));
  if (!backgroundVideo && heroImages[0]) {
    ReactDOM.preload(heroImages[0], { as: "image", fetchPriority: "high" });
  }

  // 说说气泡的头像用「关于」页设置的那个，没设再回退到站点 Logo
  const avatar = profile.avatar || site.logo;

  // 文章与说说按时间混在一条流里（说说渲染成气泡卡片，一眼能分清）
  const { entries, total: fetchedTotal, pageSize } = await listPublishedFeed({
    page,
    pageSize: HOME_PAGE_SIZE,
  });
  // 分页页已经算过总数时直接用，省一次全量查询（第 1 页没有传，就用本次查询的结果）
  const total = totalProp ?? fetchedTotal;
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
        <HeroBackground images={heroImages} video={backgroundVideo} />

        <HeroIntro name={name} subtitle={heroSubtitle} scrollLabel={t("home.scroll")} />

        {/*
          底部统一用 4 层 gentle-wave，填充内容区背景色。
          有内容区背景图时由 CSS 在首页内容顶部补一段「背景色 → 透明」过渡带，
          保证波浪底边和照片之间没有硬接缝；不再切换大曲线/丝带方案。
        */}
        <HeroWaves />
      </section>

      {/*
        内容区：左文章列表（分页）+ 右侧栏。
        `scroll-mt-*` 与 main 的顶部占位一致：封面那个下滑箭头是跳到 #home-content，
        没有它的话滚过去之后标题区会被悬浮导航胶囊盖住。
        外层保持全宽，才能让有背景图时的过渡带铺满视口；内容宽度交给内层容器。
      */}
      <div id="home-content" className="relative w-full scroll-mt-[5.25rem] sm:scroll-mt-[5.75rem]">
        {/* 有内容区背景图时显示：与波浪同色的 56px 渐变带，见 globals.css */}
        <div aria-hidden className="home-bg-bridge" />
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {/*
              标题区：问候语 + 列表标题合成一块。
              有内容区背景图时 `.page-heading` 会给它一层薄底，避免文字直接压在照片上看不清。
            */}
            <div className="page-heading mb-6">
              {/* 北京时间问候语：早上好呀 / 中午好呀 / 下午好呀 …（客户端实时计算） */}
              <Greeting locale={locale} />

              <div className="mt-4 flex items-baseline justify-between gap-4">
                <h2 className="section-title font-display text-lg">{t("home.latest")}</h2>
                <span className="text-sm text-muted-foreground">
                  {t("home.feedCount", { count: total })}
                </span>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="empty-state py-16 text-center text-muted-foreground">
                {t("site.postsEmpty")}
              </p>
            ) : (
              <div>
                {entries.map((entry, index) => (
                  <Reveal
                    key={`${entry.kind}-${entry.id}`}
                    delay={Math.min(index, 5) * 50}
                  >
                    {entry.kind === "post" ? (
                      <PostCardView post={entry.post} locale={locale} />
                    ) : (
                      <ShuoshuoCard
                        item={entry.shuoshuo}
                        locale={locale}
                        authorName={authorName}
                        avatar={avatar}
                      />
                    )}
                  </Reveal>
                ))}
              </div>
            )}

            <SitePagination basePath="" page={page} totalPages={totalPages} />
          </div>

          <SiteSidebar locale={locale} />
        </div>
        </div>
      </div>
    </>
  );
}
