"use client";

import * as React from "react";

import { usePathname } from "@/i18n/navigation";

/**
 * 页面切换过渡：只做**新内容淡入上移**，不再尝试"旧页淡出"。
 *
 * 为什么去掉 leaving 阶段：pathname 变化时 layout 的 children 已经是新页面，
 * 此时再把容器设为淡出相位，淡出的是刚提交的新内容 —— 用户看到的是
 * 「新页闪一下 → 变透明 → 再淡入」，反而比硬切更抖。离场交给浏览器导航，
 * 这里只负责进入。
 *
 * 首次挂载也走一次 entering（和原来的进站动画一致），400ms 后统一回到 idle，
 * 这样截图脚本等 `[data-phase=idle]` 的判定仍然成立。
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<"entering" | "idle">("entering");
  const first = React.useRef(true);

  // 进入相位播放 400ms 后回到 idle（首次挂载也适用）
  React.useEffect(() => {
    if (phase !== "entering") {
      return;
    }
    const toIdle = window.setTimeout(() => setPhase("idle"), 400);
    return () => window.clearTimeout(toIdle);
  }, [phase]);

  // 路由变化 → 重新进入（不再有 leaving 相位）
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPhase("entering");
  }, [pathname]);

  return (
    <div className="page-transition" data-phase={phase}>
      {children}
    </div>
  );
}
