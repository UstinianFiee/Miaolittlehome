"use client";

import { ArrowLeftIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * 文章页的阅读进度条 + 文章导航栏。
 *
 * - 进度条：视口最顶部一条渐变细线，宽度按「正文卡片已读比例」推进；
 *   用 `transform: scaleX` 而不是改 width，走合成器、不触发布局。
 * - 导航栏：滚过文章头部后才出现（否则和站点导航叠在一起太吵），
 *   显示返回列表、文章标题、进度百分比与回到顶部。
 *
 * 进度按 `#article-body`（标题 + 正文的玻璃卡）计算，不含评论，
 * 这样「读完」的判定和读者感知一致。
 */
export function ArticleBar({ title }: { title: string }) {
  const t = useTranslations();
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const frame = React.useRef<number | null>(null);

  React.useEffect(() => {
    const target = document.getElementById("article-body");

    const measure = () => {
      frame.current = null;
      const scrollY = window.scrollY;
      let next = 0;

      if (target) {
        const rect = target.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;

        if (scrollable > 40) {
          // 常规情况：按「正文卡片已读比例」推进
          next = Math.min(Math.max(-rect.top / scrollable, 0), 1);
        } else {
          // 文章本身不足一屏（scrollable ≤ 40），再按正文算进度会永远停在 0；
          // 退化成整页进度，至少能反映「读到底了」。
          const doc = document.documentElement;
          const total = doc.scrollHeight - window.innerHeight;
          next = total > 0 ? Math.min(Math.max(scrollY / total, 0), 1) : 0;
        }
      }

      // 帧级节流：只在小数点后两位变化时重渲染；CSS transition 负责补间。
      setProgress((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
      setVisible((prev) => {
        const nextVisible = scrollY > 260;
        return prev === nextVisible ? prev : nextVisible;
      });
    };

    const update = () => {
      if (frame.current !== null) {
        return;
      }
      frame.current = window.requestAnimationFrame(measure);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      {/* 顶部渐变进度条 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[linear-gradient(90deg,color-mix(in_oklab,var(--brand)_45%,transparent),var(--brand))]"
        style={{
          transform: `scaleX(${progress})`,
          opacity: progress > 0 ? 1 : 0,
          transition: "transform 120ms linear, opacity 200ms ease",
        }}
      />

      {/* 文章导航栏：滚过标题后出现 */}
      <div
        aria-hidden={!visible}
        className={cn(
          "fixed inset-x-0 top-[4.75rem] z-40 px-3 transition-all duration-300 sm:top-[5.25rem] sm:px-4",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        )}
      >
        <nav
          aria-label={t("site.articleNav")}
          className="article-bar nav-pill nav-pill-solid mx-auto flex h-11 w-full max-w-6xl items-center gap-2 rounded-xl border border-border/50 bg-[color:var(--nav-bg)] px-3 backdrop-blur-md"
        >
          <Link
            href="/posts"
            aria-label={t("site.backToPosts")}
            title={t("site.backToPosts")}
            className="press flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
          </Link>

          <span className="min-w-0 flex-1 truncate text-sm">{title}</span>

          <span
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
            title={t("site.readingProgress")}
          >
            {Math.round(progress * 100)}%
          </span>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label={t("site.backToTop")}
            title={t("site.backToTop")}
            className="press flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        </nav>
      </div>
    </>
  );
}
