"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** 移动端导航抽屉：点击任一项后自动关闭。 */
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
      <SheetContent side="right" className="w-72 p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-display flex items-center gap-2 text-left text-base">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-6 shrink-0 rounded object-cover" />
          ) : null}
          {siteName}
        </SheetTitle>
        </SheetHeader>
        <nav className="overflow-y-auto p-3">
          <NavLinks
            className="flex-col items-stretch gap-1"
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
