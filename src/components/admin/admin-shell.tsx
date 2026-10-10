"use client";

import { ExternalLinkIcon, MenuIcon } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { LogoutButton } from "@/components/admin/logout-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * 后台外壳：悬浮胶囊顶栏 + 侧边栏（≥lg 固定，小屏走抽屉）。
 *
 * 视觉刻意与前台对齐：同样的毛玻璃胶囊（`--nav-bg`）、同样的圆角与阴影、
 * 同样的站酷快乐体站点名、同样的 `--background` 底色（不再额外铺一层灰），
 * 减少前后台割裂感。
 */
export function AdminShell({
  children,
  siteName,
  logo,
}: {
  children: React.ReactNode;
  siteName: string;
  logo: string;
}) {
  const t = useTranslations();
  const [navOpen, setNavOpen] = React.useState(false);

  const brand = (
    <NextLink href="/admin" className="flex min-w-0 items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-7 shrink-0 rounded object-cover" />
      ) : (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
      )}
      <span className="font-display truncate text-lg">{siteName}</span>
      <span className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
        {t("admin.title")}
      </span>
    </NextLink>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 rounded-xl border border-border/50 bg-[color:var(--nav-bg)] px-3 shadow-sm backdrop-blur-md sm:px-5">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label={t("admin.openNav")}
              >
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-5 py-4">
                <SheetTitle className="text-left text-base">{t("admin.title")}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto p-3">
                <AdminSidebar onNavigate={() => setNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {brand}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* 返回前台：所有尺寸都显示（原来小屏被隐藏了） */}
            <Button asChild variant="ghost" size="icon-sm" className="sm:hidden">
              <NextLink href="/" aria-label={t("admin.backToSite")} title={t("admin.backToSite")}>
                <ExternalLinkIcon className="size-4" />
              </NextLink>
            </Button>
            <Button asChild variant="ghost" size="sm" className="press hidden sm:inline-flex">
              <NextLink href="/">
                <ExternalLinkIcon className="size-4" />
                {t("admin.backToSite")}
              </NextLink>
            </Button>
            <span aria-hidden className="mx-1 h-5 w-px bg-current opacity-20" />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pt-6 pb-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="surface sticky top-[5.5rem] p-3">
            <AdminSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
