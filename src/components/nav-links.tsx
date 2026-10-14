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
              data-active={active ? "true" : "false"}
              className={cn(
                "font-display nav-item press rounded-md px-2.5 py-2 text-base whitespace-nowrap transition-colors",
                /*
                 * 不用 bg-accent：--accent 是 10% 的蓝（浅色）/ 45% 的灰（深色），
                 * 当底色会让文字发糊、对比度掉得厉害。改成「选中=主题色+下划线，
                 * 悬停=只变文字色」，清晰得多。
                 */
                active
                  ? "font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
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
