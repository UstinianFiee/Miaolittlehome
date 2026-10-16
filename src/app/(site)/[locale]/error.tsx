"use client";

import { HomeIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * 前台页面级错误边界。
 *
 * ## 为什么要显式处理「资源加载失败」
 *
 * 部署新版本后，`/_next/static/` 里的文件名（内容哈希）全都会变。已经打开的标签页
 * 若还拿着旧文件名去取代码，就会拿到 404 —— React 在客户端抛异常，Next 显示
 * 内置的英文 `Application error: a client-side exception has occurred`。
 * 这不是站点代码坏了，刷新一次即可恢复，所以这里**自动刷新一次**（有节流，不会死循环）。
 *
 * 其余客户端异常（真正的 bug）走人工路径：给出「重试」按钮调用 `reset()`，
 * 让用户不必自己按 F5，也不会看到那段英文原文。
 */

const CHUNK_RELOAD_KEY = "site-chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 15_000;

/** 判断是否属于「代码分片没取到」这一类可自愈错误。 */
function isChunkLoadError(error: Error & { name?: string }): boolean {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? "");
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string; name?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  React.useEffect(() => {
    // 打印到控制台，方便排查（线上 Next 也会自行记录）。
    console.error("[site-error]", error);

    if (!isChunkLoadError(error)) return;

    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0") || 0;
    } catch {
      // 隐私模式下拿不到 sessionStorage：不做自动刷新，交给用户点「刷新页面」。
      return;
    }
    if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return;

    try {
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      /* 存不进去也无妨，下面照样刷新一次。 */
    }
    window.location.reload();
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[62vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full"
        style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
      >
        <TriangleAlertIcon className="size-7 text-primary" />
      </span>

      <h1 className="font-display mt-5 text-2xl">{t("title")}</h1>

      <p className="mt-3 max-w-md text-muted-foreground">{t("description")}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          <RefreshCwIcon className="size-4" />
          {t("retry")}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCwIcon className="size-4" />
          {t("reload")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">
            <HomeIcon className="size-4" />
            {t("backHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
