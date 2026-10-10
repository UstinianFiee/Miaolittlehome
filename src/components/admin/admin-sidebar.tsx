"use client";

import { ExternalLinkIcon } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { adminNavGroups } from "@/config/admin-nav";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  className?: string;
  /** 点击后回调（移动端抽屉用于关闭面板） */
  onNavigate?: () => void;
};

/** 后台路由不带语言前缀，因此这里使用 next/link 而非 next-intl 的 Link。 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <nav aria-label={t("admin.title")} className="space-y-6">
        {adminNavGroups.map((group) => (
          <div key={group.labelKey} className="space-y-1">
            <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t(group.labelKey)}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <NextLink
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "press flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {t(item.labelKey)}
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* 底部返回前台：抽屉里也能用，避免「进后台就出不去」 */}
      <div className="mt-6 border-t border-border/60 pt-3">
        <NextLink
          href="/"
          onClick={onNavigate}
          className="press flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <ExternalLinkIcon className="size-4 shrink-0" />
          {t("admin.backToSite")}
        </NextLink>
      </div>
    </div>
  );
}
