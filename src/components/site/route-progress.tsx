"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

/**
 * 顶部路由进度条。
 *
 * App Router 没有路由事件可监听，这里用两步驱动：
 *   1. 捕获阶段的点击事件命中内部链接 → 启动；
 *   2. pathname 变化 → 冲到 100% 后淡出。
 * 进度按「越接近 90% 越慢」的曲线逼近，避免长时间停在某个数字上显得卡住。
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = React.useCallback(() => {
    stop();
    setVisible(true);
    setProgress(8);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + (90 - prev) * 0.14));
    }, 220);
  }, [stop]);

  const finish = React.useCallback(() => {
    stop();
    setProgress(100);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setProgress(0), 260);
    }, 300);
  }, [stop]);

  // 点击内部链接 → 启动
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      // 同页面（仅 hash 或完全相同的 URL）不显示进度条
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // pathname 变化 → 收尾
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    finish();
  }, [pathname, finish]);

  React.useEffect(() => stop, [stop]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full rounded-r-full"
        style={{
          width: `${progress}%`,
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 65%, transparent) 35%, var(--primary) 75%, color-mix(in oklab, var(--primary) 30%, #ffffff))",
          boxShadow: "0 0 12px color-mix(in oklab, var(--primary) 65%, transparent)",
          transition: "width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}
