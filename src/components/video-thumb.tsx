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
 *
 * ## ⚠️ 两个必须保留的约束（都踩过）
 *
 * **1. `preload` 必须是 `"none"`。**
 * 浏览器取封面帧的方式是发 `Range: bytes=0-`，而 Nginx 的 `/media/` 是
 * `alias` + `Accept-Ranges`，会把整个文件当作一次 206 响应准备好。
 * `preload="metadata"` 时 Chrome 会一路读下去。改成 `"none"` 并**显式 `load()`**
 * 一次，浏览器只取渲染这一帧所需的片段。
 *
 * **2. 必须限制并发。**
 * 媒体库一页可能有几十个视频（`listMedia` 上限 200）。实测 62 个视频缩略图
 * 会一次性拉走 **12.6MB** —— 在 2Mbps 的机器上约 50 秒把带宽占满，
 * 期间点任何筛选按钮都在排队，用户看到的就是「整页卡死、点啥都没反应」。
 * 这里用一个模块级的闸门，**同一时刻最多 2 个缩略图去取帧**，
 * 其余排队；取到帧（或失败/超时）就放行下一个。
 * 代价只是封面依次出现，换来的是页面始终可点。
 */

/** 同时最多几个缩略图去取数据。 */
const MAX_CONCURRENT = 2;
/** 单个缩略图最长占用额度的时长，避免异常时把队列堵死。 */
const SLOT_TIMEOUT_MS = 15_000;

let active = 0;
const waiting: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiting.push(() => {
      active += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  active = Math.max(0, active - 1);
  const next = waiting.shift();
  if (next) {
    next();
  }
}

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
  /** 已经拿到并发额度，可以真的去取帧了 */
  const [armed, setArmed] = React.useState(false);
  const released = React.useRef(false);

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
      // 提前 200px 开始排队，滚到的时候基本已经不空了
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [visible]);

  // 进了视口 → 排队等额度
  React.useEffect(() => {
    if (!visible || armed) {
      return;
    }
    let cancelled = false;
    void acquireSlot().then(() => {
      if (cancelled) {
        releaseSlot();
        return;
      }
      setArmed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, armed]);

  // 拿到额度后才给 src 并显式 load()（preload="none" 时只设 src 不会触发加载）
  React.useEffect(() => {
    if (!armed) {
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }

    const done = () => {
      if (!released.current) {
        released.current = true;
        releaseSlot();
      }
    };

    el.addEventListener("loadeddata", done);
    el.addEventListener("seeked", done);
    el.addEventListener("error", done);
    try {
      el.load();
    } catch {
      done();
    }
    const timer = window.setTimeout(done, SLOT_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("loadeddata", done);
      el.removeEventListener("seeked", done);
      el.removeEventListener("error", done);
      // 卸载时一定要把额度还回去，否则队列会被永久堵住
      done();
    };
  }, [armed]);

  /*
   * 服务端渲染出来的 <video> 会在 hydration 之前就开始加载，
   * 如果文件不存在，error 事件早就发完了 —— React 挂上来的 onError 永远收不到。
   * 所以挂载后再主动查一次 el.error。
   */
  React.useEffect(() => {
    if (ref.current?.error) {
      setFailed(true);
    }
  }, [armed]);

  if (failed) {
    return <>{fallback}</>;
  }

  return (
    <video
      ref={ref}
      /* 没进视口前不给 src：既不发请求也不会 seek，容器有固定的 aspect-video，不会抖动 */
      src={armed ? `${src}#t=1` : undefined}
      muted
      playsInline
      preload="none"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
