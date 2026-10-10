"use client";

import * as React from "react";

import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 导航外壳。
 * 首页顶部时完全透明（让封面背景透出来），一旦滚动或进入其他页面就切换为毛玻璃胶囊。
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // next-intl 的 usePathname 已去掉语言前缀，首页即 "/"
  const transparent = pathname === "/" && !scrolled;

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={cn(
          // 1280px 起胶囊放宽到 78rem：导航项是英文时（Categories / Guestbook…）需要更多横向空间
          "mx-auto flex h-16 w-full max-w-6xl items-center gap-2 rounded-xl border px-4 transition-all duration-300 sm:h-[4.25rem] sm:px-6 xl:max-w-[78rem]",
          transparent
            ? // 首页封面是深色图片区，导航在这层始终用白字（与标题一致）
              "border-transparent bg-black/10 text-white shadow-none [&_*]:text-current"
            : // 用 --nav-bg 而不是 bg-card/40：后者实际只有约 29% 不透明，压在背景图上会发灰
              "border-border/50 bg-[color:var(--nav-bg)] text-[color:var(--card-foreground)] shadow-sm backdrop-blur-md"
        )}
      >
        {children}
      </div>
    </header>
  );
}
