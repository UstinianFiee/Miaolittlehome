"use client";

import { EyeIcon } from "lucide-react";
import * as React from "react";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 浏览量展示与上报（docs/SPEC.md 技术约束 16：同一浏览器 24h 内只计一次）。
 *
 * - 文章页是静态缓存的，页面上的数字是构建时的值，因此这里始终拉取一次最新值
 * - 只有 24h 内未访问过才 POST 计数；否则只 GET 刷新显示
 * - localStorage 不可用时（隐私模式等）仍然计数
 */
export function ViewCounter({ slug, initialViews }: { slug: string; initialViews: number }) {
  const [views, setViews] = React.useState(initialViews);

  React.useEffect(() => {
    let cancelled = false;
    const storageKey = `post-viewed:${slug}`;
    const url = `/api/posts/${encodeURIComponent(slug)}/views`;

    let shouldCount = true;
    try {
      const last = Number(window.localStorage.getItem(storageKey) ?? "0");
      if (Number.isFinite(last) && Date.now() - last < ONE_DAY_MS) {
        shouldCount = false;
      } else {
        window.localStorage.setItem(storageKey, String(Date.now()));
      }
    } catch {
      shouldCount = true;
    }

    void fetch(url, shouldCount ? { method: "POST", keepalive: true } : { method: "GET" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: { views?: number } } | null) => {
        if (!cancelled && typeof payload?.data?.views === "number") {
          setViews(payload.data.views);
        }
      })
      .catch(() => {
        // 计数失败不影响阅读
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <span className="inline-flex items-center gap-1">
      <EyeIcon className="size-3.5" />
      <span data-testid="post-views">{views}</span>
    </span>
  );
}
