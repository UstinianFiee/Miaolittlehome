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
  const videoRef = React.useRef<HTMLVideoElement>(null);
  /**
   * 视频「铺满」所需的显式尺寸。
   *
   * 为什么不只用 `object-fit: cover`：部分手机浏览器（安卓 X5 / 旧 WebView）
   * 根本不认 `<video>` 上的 object-fit，会按视频原始比例居中显示、上下留黑边
   * —— 表现为「电脑正常，手机是一条视频带」。
   * 这里按视频与容器的实际尺寸算出 cover 比例，写成内联宽高，
   * 再靠外层 `overflow: hidden` 裁掉溢出部分，任何浏览器都成立。
   */
  const [coverSize, setCoverSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // 量出视频铺满封面所需的尺寸；尺寸变化（转屏 / 窗口缩放）时重算
  React.useEffect(() => {
    if (!video) {
      return;
    }

    const el = videoRef.current;
    const box = el?.parentElement;
    if (!el || !box) {
      return;
    }

    const update = () => {
      const vw = el.videoWidth;
      const vh = el.videoHeight;
      const bw = box.clientWidth;
      const bh = box.clientHeight;
      if (!vw || !vh || !bw || !bh) {
        return;
      }
      const scale = Math.max(bw / vw, bh / vh);
      setCoverSize({ w: Math.ceil(vw * scale), h: Math.ceil(vh * scale) });
    };

    el.addEventListener("loadedmetadata", update);
    el.addEventListener("loadeddata", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    update();

    // 有些浏览器会拦自动播放，显式再试一次（失败也不影响 poster 兜底）
    const played = el.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => undefined);
    }

    return () => {
      el.removeEventListener("loadedmetadata", update);
      el.removeEventListener("loadeddata", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [video]);

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
        {/* isolate：把视频和遮罩关在自己的层叠上下文里，别和外层内容混层 */}
        <div aria-hidden className="absolute inset-0 -z-20 isolate overflow-hidden">
          <video
            ref={videoRef}
            className="hero-video"
            style={coverSize ? { width: `${coverSize.w}px`, height: `${coverSize.h}px` } : undefined}
            src={video}
            poster={images[0] || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>
        <div aria-hidden className="hero-veil absolute inset-0 -z-10" />
      </>
    );
  }

  if (images.length === 0) {
    /*
     * 没有背景图时的兜底封面。
     * 不能再用"淡色径向渐变"：浅色主题下它和页面底色几乎一样，
     * 白色标题 / 透明导航会直接糊掉（详见 globals.css 的 .hero-fallback 注释）。
     * 现在是深青底 + 两团漂移的苍绿极光 + 一层点阵，白字对比度足够。
     */
    return (
      <div aria-hidden className="hero-fallback absolute inset-0 -z-10 overflow-hidden">
        <span className="hero-fallback__glow hero-fallback__glow--1" />
        <span className="hero-fallback__glow hero-fallback__glow--2" />
        <span className="hero-fallback__glow hero-fallback__glow--3" />
        <span className="hero-fallback__grain" />
      </div>
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
