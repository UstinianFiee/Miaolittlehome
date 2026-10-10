"use client";

import * as React from "react";

/**
 * 打字机动效：逐字显示文本，结束后保留闪烁光标。
 * 零依赖；服务端渲染时输出空串，客户端挂载后开始打字，不会产生水合不一致。
 */
export function Typewriter({
  text,
  speed = 110,
  startDelay = 350,
  className,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
  className?: string;
}) {
  const [shown, setShown] = React.useState("");

  React.useEffect(() => {
    // 尊重系统的「减少动态效果」偏好
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(text);
      return;
    }

    let index = 0;
    let interval: ReturnType<typeof setInterval> | undefined;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        index += 1;
        setShown(text.slice(0, index));
        if (index >= text.length && interval) {
          clearInterval(interval);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [text, speed, startDelay]);

  const done = shown.length >= text.length;

  return (
    <span className={className}>
      {/* 用一个不可见副本占位，避免逐字出现时下方内容跳动 */}
      <span className="relative inline-block whitespace-nowrap">
        <span aria-hidden className="invisible">
          {text}
        </span>
        <span className="absolute inset-0">
          {shown}
          <span
            aria-hidden
            className={done ? "animate-pulse" : ""}
            style={{ marginLeft: "0.1em" }}
          >
            |
          </span>
        </span>
      </span>
    </span>
  );
}
