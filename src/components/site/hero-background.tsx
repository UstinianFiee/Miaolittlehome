"use client";

import * as React from "react";

/** 轮播间隔（毫秒）。 */
const ROTATE_MS = 7000;
/** 淡入淡出时长，需与 CSS 里的 duration 保持一致。 */
const FADE_MS = 1200;

/**
 * 首页封面背景。
 *
 * 优先级：**视频 > 多图轮播 > 单图 > 渐变底**。
 * - 视频：静音、循环、自动播放，`poster` 用第一张图兜底；
 * - 轮播：多张图叠在一起做透明度交叉淡入淡出；
 * - 图层按需挂载（只加载已经用到的那几张），并提前预取下一张，
 *   避免一次性把 10 张大图全下下来。
 * - 尊重 `prefers-reduced-motion`：开启后停在第一张，不轮播。
 */
export function HeroBackground({ images, video }: { images: string[]; video: string }) {
  const [active, setActive] = React.useState(0);
  // 已挂载的图层数量：从第 1 张开始，随轮播推进逐步增加
  const [mounted, setMounted] = React.useState(1);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // 提前把下一张读进缓存，切换时就不会闪空白
  React.useEffect(() => {
    if (images.length <= 1) {
      return;
    }
    const next = new window.Image();
    next.src = images[(active + 1) % images.length];
  }, [active, images]);

  React.useEffect(() => {
    if (images.length <= 1 || reduceMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % images.length;
        setMounted((count) => Math.max(count, next + 1));
        return next;
      });
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [images, reduceMotion]);

  if (video) {
    return (
      <>
        <video
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          src={video}
          poster={images[0] || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div aria-hidden className="hero-veil absolute inset-0 -z-10" />
      </>
    );
  }

  if (images.length === 0) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1000px 480px at 50% 0%, color-mix(in oklab, var(--primary) 24%, transparent), transparent 70%)",
        }}
      />
    );
  }

  return (
    <>
      {images.slice(0, mounted).map((src, index) => (
        <div
          key={`${index}-${src}`}
          aria-hidden
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage: `url("${src}")`,
            opacity: index === active ? 1 : 0,
            transition: reduceMotion ? undefined : `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      ))}
      <div aria-hidden className="hero-veil absolute inset-0 -z-10" />
    </>
  );
}
