"use client";

import * as React from "react";

/**
 * 全站兜底错误边界。
 *
 * `[locale]/error.tsx` 只能兜住「页面」部分的异常 —— 它位于语言布局**内部**，
 * 所以挂在布局里的组件（ConfigSync、顶部导航、悬浮播放器）一旦抛错，
 * 就会一路上抛到 Next 内置的错误页，用户看到的是那段英文
 * `Application error: a client-side exception has occurred`。
 *
 * 这个文件就是接住那种情况的：它在根布局**之外**渲染，因此必须自带
 * `<html>` / `<body>`，也不能依赖 next-intl 或项目里的 CSS 变量
 * （出错时这些可能都不可用），所以样式全部内联。
 *
 * 同样处理「部署后旧标签页拿了失效的代码分片」——自动刷新一次即可恢复。
 */

const CHUNK_RELOAD_KEY = "site-chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 15_000;

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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string; name?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = React.useState<"zh" | "en">("zh");

  React.useEffect(() => {
    console.error("[global-error]", error);

    const lang = document.documentElement.lang || navigator.language || "zh";
    if (!lang.toLowerCase().startsWith("zh")) setLocale("en");

    if (!isChunkLoadError(error)) return;

    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0") || 0;
    } catch {
      return;
    }
    if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return;
    try {
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      /* 忽略：照样刷新一次。 */
    }
    window.location.reload();
  }, [error]);

  const zh = locale === "zh";
  const copy = zh
    ? {
        title: "页面出了点问题",
        description: "页面加载时遇到了一个临时问题，刷新一下通常就能恢复。",
        retry: "重试",
        reload: "刷新页面",
      }
    : {
        title: "Something went wrong",
        description: "The page hit a temporary problem while loading. Reloading usually fixes it.",
        retry: "Try again",
        reload: "Reload page",
      };

  const button: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    minHeight: "2.75rem",
    padding: "0 1.25rem",
    borderRadius: "9999px",
    border: "1px solid transparent",
    background: "#087780",
    color: "#ffffff",
    font: "inherit",
    fontSize: "0.95rem",
    cursor: "pointer",
  };

  const outline: React.CSSProperties = {
    ...button,
    background: "transparent",
    borderColor: "#97bdbb",
    color: "#153a3e",
  };

  return (
    <html lang={zh ? "zh" : "en"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#eef0f3",
          color: "#30474b",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", color: "#153a3e", margin: "0 0 0.75rem" }}>{copy.title}</h1>
          <p style={{ margin: "0 0 1.75rem", lineHeight: 1.7 }}>{copy.description}</p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" style={button} onClick={reset}>
              {copy.retry}
            </button>
            <button type="button" style={outline} onClick={() => window.location.reload()}>
              {copy.reload}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
