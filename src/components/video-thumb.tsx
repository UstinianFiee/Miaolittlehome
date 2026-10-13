"use client";

import * as React from "react";

/**
 * 视频封面：直接渲染 <video> 让浏览器显示某一帧。
 *
 * 服务端没装 ffmpeg，上传视频时生成不了缩略图（`media.thumb` 一直是 null），
 * 媒体库里就只剩一个胶片图标 —— 视频一多完全分不清谁是谁。
 * 这里用媒体片段 `#t=1` 让浏览器 seek 到第 1 秒并停住，白拿一张封面：
 * 不占额外存储、不用改上传流程，**对已经传过的视频同样有效**。
 *
 * 文件缺失或编码不被支持时回退到 `fallback`，避免留一个空白框。
 */
export function VideoThumb({
  src,
  className,
  fallback = null,
}: {
  src: string;
  className?: string;
  /** 加载失败时显示的内容（例如胶片图标） */
  fallback?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = React.useState(false);
  /**
   * 「进了视口附近才去请求」—— 视频列表一页可能有几十个缩略图，
   * 每个都要向服务端要一段数据才能 seek 出第 1 秒。用 IntersectionObserver
   * 观察元素本身，没进入视口前不给 src，浏览器就不会发起请求。
   */
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || visible) {
      return;
    }

    if (typeof IntersectionObserver !== "function") {
      // 老浏览器没有 IO：直接给 src，至少能正常显示
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // 提前 300px 开始加载，滚到的时候基本已经不空了
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [visible]);

  /*
   * 服务端渲染出来的 <video> 会在 hydration 之前就开始加载，
   * 如果文件不存在，error 事件早就发完了 —— React 挂上来的 onError 永远收不到。
   * 所以挂载后再主动查一次 el.error。
   */
  React.useEffect(() => {
    if (ref.current?.error) {
      setFailed(true);
    }
  }, [visible]);

  if (failed) {
    return <>{fallback}</>;
  }

  return (
    <video
      ref={ref}
      /* 没进视口前不给 src：既不发请求也不会 seek，容器有固定的 aspect-video，不会抖动 */
      src={visible ? `${src}#t=1` : undefined}
      muted
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
