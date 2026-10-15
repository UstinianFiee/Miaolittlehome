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
    <ul className={cn("flex items-center gap-0 2xl:gap-0.5", className)}>
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
                /*
                 * 12 个导航项（英文 Home / Categories / Guestbook…）在 1280~1536px 这一段
                 * 挤得非常紧，实测只剩 9px 余量 —— 换个字体或换个系统就直接顶出去、
                 * 最后两项被裁掉。所以这一档刻意收小：字号 0.9rem、内边距 1.5、
                 * 项间不留空隙；到 2xl 空间够了再放大回接近全尺寸。
                 * 改这几个值前先用 `.verify/probe-nav-width.mjs` 量一遍余量。
                 */
                "font-display nav-item press rounded-md px-1.5 py-1.5 text-[0.9rem] whitespace-nowrap transition-colors",
                "2xl:px-2 2xl:text-[0.95rem]",
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
