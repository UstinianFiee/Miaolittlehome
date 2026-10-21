"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** 每字错开 110ms；配合 CSS 里 460ms 的单字动画，观感是"一个一个冒出来" */
const CHAR_STAGGER_MS = 110;
const CHAR_IN_MS = 460;
/** 收尾光晕的时长，用于把 data-ready 的时机卡在落定之后 */
const SETTLE_MS = 120;

/**
 * 首页主标题：**逐字显现，落定后整行收一次柔光，然后才让内容出场**。
 *
 * 为什么是一次性动画而不是常驻循环：早先每个字无限上下起伏 + 整行呼吸光晕，
 * 两个常驻动效叠在一起视觉很杂（用户反馈"太杂了"）。现在收敛成入场序列：
 *   逐字淡入 → 全部落定 → 一次收尾光晕 → onDone 通知父组件放出副标题与正文
 * 立体阴影仍在（--hero-depth），只是不再闪。
 *
 * 尊重 prefers-reduced-motion：直接落定并立即回调，不等动画。
 */
export function HeroTitle({
  text,
  className,
  onDone,
}: {
  text: string;
  className?: string;
  onDone?: () => void;
}) {
  const chars = Array.from(text);
  const [ready, setReady] = React.useState(false);
  /**
   * onDone 存进 ref：父组件每次渲染都会传新的箭头函数，若把它写进依赖数组，
   * 任何重渲染都会清掉并重排下面两个定时器（至少多跑一轮 onDone，最坏成循环）。
   */
  const onDoneRef = React.useRef(onDone);

  React.useEffect(() => {
    onDoneRef.current = onDone;
  });

  const totalMs = Math.max(0, (chars.length - 1) * CHAR_STAGGER_MS + CHAR_IN_MS + SETTLE_MS);

  React.useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setReady(true);
      onDoneRef.current?.();
      return;
    }

    const settle = window.setTimeout(() => setReady(true), totalMs);
    const done = window.setTimeout(() => onDoneRef.current?.(), totalMs);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(done);
    };
  }, [totalMs]);

  return (
    <h1 className={cn("hero-title", className)} data-ready={ready ? "true" : "false"}>
      {chars.map((char, index) => (
        <span
          key={index}
          className="hero-char"
          style={{ animationDelay: `${index * CHAR_STAGGER_MS}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}
