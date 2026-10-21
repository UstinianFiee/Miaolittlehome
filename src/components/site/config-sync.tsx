"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

/**
 * 前台内容同步器（不渲染任何东西）。
 *
 * 后台写操作会通过 revalidatePath 清掉服务端 ISR 缓存，但已经打开的标签页
 * 可能还在用 Next 的客户端路由缓存。这里轮询内容版本号，一旦发现后台改过内容，
 * 就对当前路由调用 router.refresh() 拉一份新的。
 *
 * 版本号现在由服务端缓存 60 秒生成（见 lib/settings.ts 的 getSiteVersion），
 * 后台写操作会 revalidateTag 主动失效，所以轮询间隔同步放宽到 60 秒；
 * 页面在后台标签页（不可见）时跳过轮询，重新可见时立刻补查一次，
 * 既不影响「改完很快看到」，也不会让每个打开的标签页持续读库。
 */
const CHECK_INTERVAL_MS = 60_000;
const REFRESH_RETRY_MS = 30_000;

export function ConfigSync({ version }: { version: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastRefresh = React.useRef<{ target: string; at: number } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let checking = false;

    async function checkVersion() {
      if (checking) return;
      // 标签页不可见时不轮询：省掉后台标签页无意义的请求
      if (document.visibilityState !== "visible") return;
      checking = true;

      try {
        const response = await fetch("/api/site-version", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { version?: string };
        if (cancelled || !data.version) return;
        if (data.version === version) {
          lastRefresh.current = null;
          return;
        }

        const now = performance.now();
        const previous = lastRefresh.current;
        if (
          !previous ||
          previous.target !== data.version ||
          now - previous.at >= REFRESH_RETRY_MS
        ) {
          // 同一个新版本号最多 30 秒刷新一次，避免失败后每个轮询周期都刷新
          lastRefresh.current = { target: data.version, at: now };
          router.refresh();
        }
      } catch {
        // 网络错误是暂时的，下一次轮询会自动重试
      } finally {
        checking = false;
      }
    }

    void checkVersion();
    const timer = window.setInterval(() => void checkVersion(), CHECK_INTERVAL_MS);
    // 从后台标签页切回来时立刻补查一次，不用等下一个 60 秒
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [version, pathname, router]);

  return null;
}
