"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 循环打字机（首页封面副标题用）。
 *
 * 行为：逐字打出 → 停留一会儿 → 逐字删除 → 短暂停顿 → 重新开始。
 * 全程**保持单行**（whitespace-nowrap），配合 hero-intro 里按文字长度换算的
 * 响应式字号，手机 375/390 宽度也能整句显示，不会被封面容器裁掉。
 *
 * 零依赖；SSR 时输出空串，客户端挂载后才开始打，不会有水合不一致。
 * 尊重 prefers-reduced-motion：直接显示整句、不循环。
 */
const HOLD_MS = 2600; // 整句停留
const DELETE_MS = 45; // 删除速度
const RESTART_MS = 650; // 清空后重新开始的停顿

export function Typewriter({
  text,
  speed = 110,
  startDelay = 350,
  className,
}: {
  text: string;
  /** 逐字出现的间隔（毫秒） */
  speed?: number;
  /** 首次开始前的延迟（毫秒） */
  startDelay?: number;
  className?: string;
}) {
  const [shown, setShown] = React.useState("");

  React.useEffect(() => {
    if (!text) {
      setShown("");
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(text);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let index = 0;
    let phase: "typing" | "holding" | "deleting" = "typing";

    const step = () => {
      if (cancelled) {
        return;
      }

      if (phase === "typing") {
        index = Math.min(index + 1, text.length);
        setShown(text.slice(0, index));
        if (index >= text.length) {
          phase = "holding";
          timer = setTimeout(step, HOLD_MS);
        } else {
          timer = setTimeout(step, speed);
        }
        return;
      }

      if (phase === "holding") {
        phase = "deleting";
        timer = setTimeout(step, DELETE_MS);
        return;
      }

      index = Math.max(index - 1, 0);
      setShown(text.slice(0, index));
      if (index === 0) {
        phase = "typing";
        timer = setTimeout(step, RESTART_MS);
      } else {
        timer = setTimeout(step, DELETE_MS);
      }
    };

    timer = setTimeout(step, startDelay);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [text, speed, startDelay]);

  return (    <span
      className={cn("typewriter inline-block align-bottom", className)}
      aria-label={text}
    >
      <span aria-hidden className="whitespace-nowrap">
        {shown}
      </span>
      {/*
        光标用一条细竖条而不是字符 "|"：不受字体字形宽度影响，
        删除到空串时也不会让整行宽度塌一下。
      */}
      <span
        aria-hidden
        className="typewriter__caret ml-[0.09em] inline-block h-[1em] w-[0.09em] translate-y-[0.12em] animate-pulse rounded-full bg-current align-baseline"
      />
    </span>
  );
}
