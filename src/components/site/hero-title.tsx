"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 首页主标题：逐字轻柔起伏 + 悬停变色 + 整行呼吸光晕。
 *
 * 三层效果都由 CSS 完成（见 globals.css）：
 *   hero-bounce  —— 每个字上下轻浮，按索引错开延迟形成波浪；
 *   :hover       —— 鼠标悬停的单个字变主题色；
 *   hero-breathe —— 整行光晕缓慢明暗，像呼吸一样（比扫光更柔和）。
 * 尊重 prefers-reduced-motion。
 */
export function HeroTitle({ text, className }: { text: string; className?: string }) {
  const chars = Array.from(text);

  return (
    <h1 className={cn("hero-title", className)}>
      {chars.map((char, index) => (
        <span
          key={index}
          className="hero-char"
          style={{ animationDelay: `${index * 130}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  );
}
