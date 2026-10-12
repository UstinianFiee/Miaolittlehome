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

  /*
   * 服务端渲染出来的 <video> 会在 hydration 之前就开始加载，
   * 如果文件不存在，error 事件早就发完了 —— React 挂上来的 onError 永远收不到。
   * 所以挂载后再主动查一次 el.error。
   */
  React.useEffect(() => {
    if (ref.current?.error) {
      setFailed(true);
    }
  }, []);

  if (failed) {
    return <>{fallback}</>;
  }

  return (
    <video
      ref={ref}
      src={`${src}#t=1`}
      muted
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
