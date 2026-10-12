import "@fontsource/zcool-kuaile";

import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { MusicPlayerLazy } from "@/components/site/music-player-lazy";
import { RippleLayer } from "@/components/site/ripple-layer";
import { RouteProgress } from "@/components/site/route-progress";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { getSiteInfo } from "@/lib/settings";
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
    ...(info.favicon
      ? { icons: { icon: info.favicon, shortcut: info.favicon, apple: info.favicon } }
      : {}),
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
  const [tracks, site] = await Promise.all([getPlaylist(), getSiteInfo()]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
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
                    半透明遮罩：压在背景图之上、内容之下。
                    透明度压到 75% 而不是 88%——再高就只剩纯色底了，背景图等于白设。
                    卡片本身也是半透明的，文字对比度靠卡片承担。
                  */}
                  <div aria-hidden className="fixed inset-0 -z-10 bg-background/75" />
                </>
              ) : null}
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
