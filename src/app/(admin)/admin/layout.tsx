import "@fontsource/zcool-kuaile";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { ThemeProvider } from "@/components/theme-provider";
import { catalogs } from "@/lib/messages";
import { getSiteInfo } from "@/lib/settings";

import "../../globals.css";

/**
 * 后台根布局：不参与语言路由，界面固定中文。
 * 仍接入 next-intl（显式传入 zh 语言包），保证文案同样不硬编码在组件里。
 */
export async function generateMetadata(): Promise<Metadata> {
  const info = await getSiteInfo();

  return {
    title: {
      default: catalogs.zh.nav.admin,
      template: `%s · ${info.name}`,
    },
    robots: {
      index: false,
      follow: false,
    },
    ...(info.favicon
      ? { icons: { icon: info.favicon, shortcut: info.favicon, apple: info.favicon } }
      : {}),
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider locale="zh" messages={catalogs.zh}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            <div className="flex min-h-screen flex-col">{children}</div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
