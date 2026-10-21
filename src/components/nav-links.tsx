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
                 * 挤得非常紧。注意顶栏内层容器是 max-w-6xl（1224px）固定宽度：
                 * 视口再宽，导航可用空间也不会继续变大 —— 所以**不要**在 2xl 放大字号/内边距，
                 * 否则 1536px 起导航内容会比可用宽度多出 70px，最后两项被裁掉。
                 * 全宽度统一用这一档：0.875rem / px-1.5，项间无空隙。
                 * 改这几个值前先用 `.verify/ui-verify.mjs` 量一遍导航是否被压缩。
                 */
                "font-display nav-item press rounded-md px-1.5 py-1.5 text-[0.875rem] whitespace-nowrap transition-colors max-sm:px-3 max-sm:py-3.5",
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
