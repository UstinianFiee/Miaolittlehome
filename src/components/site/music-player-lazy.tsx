"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { PlaylistTrack } from "@/lib/playlist";

/**
 * 播放器延迟加载壳。
 *
 * 播放器挂在站点语言布局里，会被**每一个前台页面**引用。如果直接静态引入，
 * 它的代码（含 10 个图标 + 播放逻辑）就会进入每个页面的首包。
 * 这里改成：先渲染空壳，等页面空闲（或用户第一次交互）再加载真正的播放器。
 *
 * 之所以能用 `ssr: false`：播放器本来就是纯客户端交互组件，
 * 服务端渲染它没有任何 SEO / 首屏价值。
 */
const MusicPlayer = dynamic(() => import("./music-player").then((mod) => mod.MusicPlayer), {
  ssr: false,
});

export function MusicPlayerLazy({ tracks }: { tracks: PlaylistTrack[] }) {
  const [ready, setReady] = React.useState(false);
  const hasTracks = tracks.length > 0;

  React.useEffect(() => {
    if (!hasTracks) {
      return;
    }

    let cancelled = false;
    const activate = () => {
      if (!cancelled) {
        setReady(true);
      }
    };

    // 优先用空闲回调；不支持时退化成一次短延时
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    const timer = idle
      ? idle(activate, { timeout: 2000 })
      : window.setTimeout(activate, 1000);

    // 用户一旦有交互就立刻加载，不用等空闲
    window.addEventListener("pointerdown", activate, { once: true });
    window.addEventListener("keydown", activate, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
    };
  }, [hasTracks]);

  if (!hasTracks || !ready) {
    return null;
  }

  return <MusicPlayer tracks={tracks} />;
}
