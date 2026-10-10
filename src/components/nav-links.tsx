"use client";

import { useTranslations } from "next-intl";

import { navItems } from "@/config/site";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavLinksProps = {
  className?: string;
  /** 点击后回调（移动端抽屉用于关闭面板） */
  onNavigate?: () => void;
};

/** usePathname 来自 next-intl，返回值不含语言前缀。 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ className, onNavigate }: NavLinksProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <ul className={cn("flex items-center gap-0.5", className)}>
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "font-display press rounded-md px-2.5 py-2 text-base whitespace-nowrap transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {t(item.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
