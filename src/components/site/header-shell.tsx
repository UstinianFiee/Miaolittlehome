"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 顶部导航外壳（2026-10-18 按参考站点改版）。
 *
 * 和原来的「悬浮胶囊」不同，现在是**全宽固定栏**：
 * - 首页顶部：透明、白字，让封面图直接透出来；
 * - 滚动 24px 后：半透明底色 + 15px 模糊 + 1px 底边线（参考站点的毛玻璃栏）；
 * - 向下滚过 220px：整个菜单行上滑淡出，中央显示站点名；
 *   鼠标移到站点名上显示「回到顶部」，点击回到页首；向上滚动恢复菜单。
 *   这是参考站点最明显的导航交互，移动端不启用（否则会失去菜单入口）。
 */
export function HeaderShell({
  children,
  siteName,
}: {
  children: React.ReactNode;
  siteName: string;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const [scrolled, setScrolled] = React.useState(false);
  const [compact, setCompact] = React.useState(false);
  const lastY = React.useRef(0);
  const frame = React.useRef<number | null>(null);

  React.useEffect(() => {
    lastY.current = window.scrollY;
    // 路由切换后如果还停在上一次的收起态，会看不到菜单入口；这里一并复位
    setCompact(false);
    setScrolled(window.scrollY > 24);

    const measure = () => {
      frame.current = null;
      const y = window.scrollY;
      const nextScrolled = y > 24;
      const down = y > lastY.current;

      setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));

      if (y > 220 && down) {
        setCompact(true);
      } else if (y < 140 || !down) {
        setCompact(false);
      }

      lastY.current = y;
    };

    const onScroll = () => {
      if (frame.current !== null) {
        return;
      }
      frame.current = window.requestAnimationFrame(measure);
    };

    // 首次同步一次，避免刷新在中间位置时导航状态不对
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  // next-intl 的 usePathname 已去掉语言前缀，首页即 "/"
  const transparent = pathname === "/" && !scrolled;

  return (
    <header
      className={cn(
        "site-header",
        transparent ? "site-header--transparent" : "site-header--solid"
      )}
    >
      <div className="site-header__bar">
        <div className="site-header__inner">
          <div
            className={cn(
              "site-header__row",
              transparent && "text-white [&_*]:text-current"
            )}
            data-compact={compact ? "true" : "false"}
          >
            {children}
          </div>

          <button
            type="button"
            className="site-header__title"
            data-compact={compact ? "true" : "false"}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            tabIndex={compact ? 0 : -1}
            aria-hidden={compact ? undefined : true}
            aria-label={t("site.backToTop")}
          >
            <span className="site-header__title-name">{siteName}</span>
            <span className="site-header__title-hint">{t("site.backToTop")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
