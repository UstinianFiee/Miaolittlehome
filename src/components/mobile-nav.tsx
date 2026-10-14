"use client";

import { LogInIcon, MenuIcon } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { adminEntry } from "@/config/site";

/**
 * 移动端导航抽屉：点击任一项后自动关闭。
 *
 * 后台入口必须放在这里：顶栏那个图标按钮是 `hidden sm:inline-flex` 的
 * （窄屏胶囊里放不下），640px 以下如果抽屉里也没有，手机上就**完全没有进后台的路**。
 * 后台不参与语言路由，所以这里用 `next/link` 而不是 next-intl 的 Link。
 */
export function MobileNav({ siteName, logo }: { siteName: string; logo?: string }) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          aria-label={t("actions.openMenu")}
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      {/*
        整块面板自己滚（而不是只让 nav 滚）：这样后台入口紧跟在菜单项后面，
        不会因为 flex-1 被推到最底部、上方留一大块空白。
        SheetFooter 自带 mt-auto，这里用 mt-0 抵消，否则又会被推到底。
      */}
      <SheetContent side="right" className="w-72 overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-display flex items-center gap-2 text-left text-base">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-6 shrink-0 rounded object-cover" />
          ) : null}
          {siteName}
        </SheetTitle>
        </SheetHeader>

        <nav className="p-3">
          <NavLinks
            className="flex-col items-stretch gap-1"
            onNavigate={() => setOpen(false)}
          />
        </nav>

        <SheetFooter className="mt-0 border-t p-3">
          <NextLink
            href={adminEntry.href}
            onClick={() => setOpen(false)}
            className="font-display press flex items-center gap-2 rounded-md px-2.5 py-2 text-base text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogInIcon className="size-4" />
            {t(adminEntry.labelKey)}
          </NextLink>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

