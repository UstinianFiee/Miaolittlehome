"use client";

import * as React from "react";

import { usePathname } from "@/i18n/navigation";

/**
 * 页面切换过渡：**旧内容先淡出，新内容再淡入**。
 *
 * 为什么必须挂在 layout（而不是 `template.tsx`）：`template` 会随每次路由变化
 * **重新挂载**，拿不到"上一次的 pathname"，也就没有"淡出旧页"的时机。
 * 这个组件挂在 layout 里是持久的，能观察到 pathname 的变化。
 *
 * 时序（总长约 470ms）：
 *   1. pathname 变化 → 立刻 `is-leaving`（opacity 1→0，150ms 线性）；
 *   2. 150ms 后换到 `is-entering`，新内容（此时已在 DOM 里）淡入上移（320ms）。
 * React 提交新 DOM 与第 1 步在同一帧完成，所以用户看到的是
 * 「当前内容变暗消失 → 新内容浮现」，而不是硬切。
 *
 * 首次挂载不走这套（直接进入 entering），避免进站时先黑一下。
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<"entering" | "leaving" | "idle">("entering");
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPhase("leaving");
    const toEnter = window.setTimeout(() => setPhase("entering"), 150);
    return () => window.clearTimeout(toEnter);
  }, [pathname]);

  React.useEffect(() => {
    if (phase !== "entering") return;
    const toIdle = window.setTimeout(() => setPhase("idle"), 320);
    return () => window.clearTimeout(toIdle);
  }, [phase]);

  return (
    <div
      className="page-transition"
      data-phase={phase}
      data-leaving={phase === "leaving" ? "true" : undefined}
    >
      {children}
    </div>
  );
}
