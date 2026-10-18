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
          <img src={logo} alt="" className="size-8 shrink-0 rounded object-cover" />
        ) : (
          <span aria-hidden className="size-2 rounded-full bg-brand ring-4 ring-brand/20" />
        )}
        {/* 站点名过长时截断，避免把导航和右侧控件挤出胶囊 */}
        <span className="max-w-[9rem] truncate sm:max-w-[15rem]">{name}</span>
      </Link>

        {/*
          桌面导航：英文文案（Categories / Guestbook…）比中文长得多，
          窄屏放不下会溢出胶囊、压到右侧控件上。
          因此 1280px 起才显示，并且容器可收缩 + 横向滚动兜底（滚动条隐藏）。
        */}
        <nav
          aria-label={t("nav.primary")}
          className="scrollbar-none hidden min-w-0 overflow-x-auto xl:block"
        >
          <NavLinks className="ml-2" />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/search" aria-label={t("search.title")}>
              <SearchIcon className="size-4" />
            </Link>
          </Button>
          <LocaleSwitcher />
          <ThemeToggle />
          {/* 竖分隔线：把「主题切换」和「后台入口」明确分开，之前贴得太近 */}
          <span aria-hidden className="mx-1.5 h-5 w-px bg-current opacity-20" />
          {/*
            后台入口：窄屏只显示图标（英文 "Sign in" 会挤占导航空间），
            2xl 起空间充裕再补上文字；两者都带 aria-label，无障碍不受影响。
          */}
          <Button asChild variant="ghost" size="sm" className="nav-login-button hidden sm:inline-flex">
            {/* 后台不参与语言路由，这里必须用 next/link，不能用 next-intl 的 Link */}
            <NextLink href={adminEntry.href} aria-label={t(adminEntry.labelKey)} title={t(adminEntry.labelKey)}>
              <LogInIcon className="size-4" />
              <span className="hidden 2xl:inline">{t(adminEntry.labelKey)}</span>
            </NextLink>
          </Button>
          <MobileNav siteName={name} logo={logo} />
        </div>
    </HeaderShell>
  );
}
