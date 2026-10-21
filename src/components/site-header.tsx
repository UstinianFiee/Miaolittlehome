import { LogInIcon, SearchIcon } from "lucide-react";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks } from "@/components/nav-links";
import { HeaderShell } from "@/components/site/header-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { adminEntry } from "@/config/site";
import { Link } from "@/i18n/navigation";
import { resizedImageUrl } from "@/lib/image-url";
import { getSiteInfo } from "@/lib/settings";

/** 全站顶部导航：桌面横排 + 移动端抽屉 + 语言切换 + 主题切换 + 后台登录入口。 */
export async function SiteHeader() {
  const t = await getTranslations();
  const { name, logo } = await getSiteInfo();

  return (
    <HeaderShell siteName={name}>
      <Link
        href="/"
        className="font-display flex shrink-0 items-center gap-2 text-[1.375rem] font-semibold tracking-tight"
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resizedImageUrl(logo, 128)}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded object-cover"
          />
        ) : (
          <span aria-hidden className="size-2 rounded-full bg-brand ring-4 ring-brand/20" />
        )}
        {/* 站点名过长时截断（悬停 title 看全名），给导航和右侧控件留空间 */}
        <span
          className="max-w-[6rem] truncate sm:max-w-[9rem] 2xl:max-w-[11rem]"
          title={name}
        >
          {name}
        </span>
      </Link>

        {/*
          桌面导航：英文文案（Categories / Guestbook…）比中文长得多，
          窄屏放不下会溢出胶囊、压到右侧控件上。
          因此 1280px 起才显示；容器用 flex-1 + min-w-0 吃掉中间剩余空间，
          真放不下时只在导航内部横向滚动（滚动条隐藏），
          绝不把右侧控件挤出视口；站点名过长时优先截断站名而不是裁导航。
        */}
        <nav
          aria-label={t("nav.primary")}
          className="scrollbar-none hidden min-w-0 flex-1 overflow-x-auto xl:block"
        >
          <NavLinks className="ml-2" />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/*
            搜索入口在手机顶栏放不下（站名 + 44px 触控目标后没有余量），
            收到移动端抽屉里（见 mobile-nav.tsx），640px 起恢复图标按钮。
          */}
          <Button asChild variant="ghost" size="icon-sm" className="hidden sm:inline-flex">
            <Link href="/search" aria-label={t("search.title")}>
              <SearchIcon className="size-4" />
            </Link>
          </Button>
          <LocaleSwitcher />
          <ThemeToggle />
          {/* 竖分隔线：把「主题切换」和「后台入口」明确分开，之前贴得太近 */}
          <span aria-hidden className="mx-1.5 h-5 w-px bg-current opacity-20" />
          {/*
            后台入口：只显示图标（带 aria-label / title）。
            **不要在 2xl 补文字**：顶栏内层是 max-w-6xl 固定宽，1536px 起点一旦多出
            “Sign in / 登录” 约 50px，英文 12 个导航项就会被压缩裁切（实测 822 > 745）。
            需要文字入口时放移动端抽屉里（MobileNav 底部本来就有）。
          */}
          <Button asChild variant="ghost" size="sm" className="nav-login-button hidden sm:inline-flex">
            {/* 后台不参与语言路由，这里必须用 next/link，不能用 next-intl 的 Link */}
            <NextLink href={adminEntry.href} aria-label={t(adminEntry.labelKey)} title={t(adminEntry.labelKey)}>
              <LogInIcon className="size-4" />
            </NextLink>
          </Button>
          <MobileNav siteName={name} logo={logo} />
        </div>
    </HeaderShell>
  );
}
