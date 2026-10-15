import "@fontsource/zcool-kuaile";

import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ConfigSync } from "@/components/site/config-sync";
import { MusicPlayerLazy } from "@/components/site/music-player-lazy";
import { RippleLayer } from "@/components/site/ripple-layer";
import { RouteProgress } from "@/components/site/route-progress";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SitePreloader } from "@/components/site/site-preloader";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteInfo, getSiteVersion } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/lib/metadata";
import { getPlaylist } from "@/lib/playlist";

import "../../globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** 让 /zh、/en 在构建期静态生成。 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * 前台页面统一走 ISR（60 秒后台重新验证）。
 *
 * 为什么必须有这个：Docker 构建时容器里没有生产数据库，页面只能按「空库」生成一次。
 * 没有 revalidate 的话，首次部署后列表页会一直是空的，要等后台改内容触发
 * revalidatePath 才会刷新。有了它，容器启动并写入种子数据后，最多 60 秒
 * 页面就会自动重新生成，无需人工干预。
 *
 * 布局里的 route segment config 会作用到其下所有页面（含动态路由）。
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: Omit<LocaleLayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const info = await getSiteInfo();

  return {
    title: {
      default: info.name,
      template: `%s · ${info.name}`,
    },
    description: info.description || t("site.description"),
    alternates: buildAlternates(locale),
    /*
     * 页签图标。
     *
     * 这里**必须**显式声明 icons，不能只靠 `src/app/favicon.ico` 那个约定：
     * 约定生成的是 `<link rel="icon" href="/favicon.ico" sizes="16x16">`，
     * 浏览器挑页签图标时优先「精确尺寸匹配」，会一直选中这个内置的 16×16，
     * 站点设置里配的 favicon（没有 sizes，按 any 处理）就永远不显示。
     * 所以内置图标挪到了 `public/favicon.ico`（仍能响应 /favicon.ico 请求，
     * 但不再自动注入 link），由这里统一决定用哪个。
     */
    icons: info.favicon
      ? { icon: info.favicon, shortcut: info.favicon, apple: info.favicon }
      : { icon: "/favicon.ico", shortcut: "/favicon.ico" },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // 开启静态渲染：把 params 中的 locale 提供给所有 next-intl 服务端 API
  setRequestLocale(locale);

  // 播放列表与站点设置都在服务端读取；播放器挂在布局里，路由切换时不重新挂载
  const [tracks, site, siteVersion] = await Promise.all([
    getPlaylist(),
    getSiteInfo(),
    getSiteVersion(),
  ]);

  const { name, logo } = site;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            <div
              className={cn(
                "relative flex min-h-screen flex-col",
                // 有内容区背景图时卡片底色加实（见 globals.css 的 .has-page-bg）
                site.pageBackground && "has-page-bg"
              )}
            >
              {site.pageBackground ? (
                <>
                  <div
                    aria-hidden
                    className="fixed inset-0 -z-20 bg-cover bg-center"
                    style={{ backgroundImage: `url("${site.pageBackground}")` }}
                  />
                  {/*
                    背景图遮罩保持轻薄：上方稍微压暗/提亮，向下快速淡出，避免整页蒙一层灰白。
                    文章卡片与说说气泡各自承担文字可读性；具体透明度集中定义在 globals.css。
                  */}
                  <div aria-hidden className="page-background-scrim fixed inset-0 -z-10" />
                </>
              ) : null}
              {/* 站点设置改动后，把还停在旧版本上的客户端路由缓存刷掉 */}
              <ConfigSync version={siteVersion} />
              {/* 访问时的进场加载动画（只在页面还没加载完时出现，见组件注释） */}
              <SitePreloader logo={logo} siteName={name} />
              <RouteProgress />
              <RippleLayer />
              <SiteHeader />
              {/* 顶部导航为 fixed 悬浮胶囊，这里补出占位高度（胶囊 4rem/4.25rem + 上边距） */}
              <main className="flex-1 pt-[5.25rem] sm:pt-[5.75rem]">{children}</main>
              <SiteFooter />
              {/* 播放器延迟加载：它的代码不属于首屏关键路径（见 music-player-lazy.tsx） */}
              <MusicPlayerLazy tracks={tracks} />
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
