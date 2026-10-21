"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import "vditor/dist/index.css";

import { Button } from "@/components/ui/button";

import type Vditor from "vditor";

let vditorPromise: Promise<typeof import("vditor")> | null = null;

function loadVditor() {
  // 失败时清空缓存，否则后续重试会一直拿到 rejected promise
  vditorPromise ??= import("vditor").catch((error: unknown) => {
    vditorPromise = null;
    throw error;
  });
  return vditorPromise;
}

// This module is only used by the post editor. Start fetching Vditor as soon as
// the browser evaluates the route chunk instead of waiting for React effects.
if (typeof window !== "undefined") {
  void loadVditor().catch(() => {
    // 预热失败交给编辑器里的重试逻辑处理，这里只避免 unhandled rejection
  });
}

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** 初始高度，支持 CSS 值（默认随视口在 360~560px 之间自适应） */
  height?: number | string;
  /** 供外部 Label 关联（aria-labelledby） */
  ariaLabelledBy?: string;
};

/** 编辑器高度：窄屏不占满整屏，宽屏保持原来的阅读高度。 */
const EDITOR_HEIGHT = "clamp(360px, 55vh, 560px)";

/**
 * Vditor 封装。
 * - 只在浏览器端动态加载（vditor 依赖 DOM，不能参与 SSR）
 * - 资源自托管：cdn 指向 /vditor（由 scripts/sync-vditor.mjs 生成）
 * - 工具栏含「编辑模式」按钮，可在即时渲染 / 所见即所得 / 分屏预览间切换
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  height = EDITOR_HEIGHT,
  ariaLabelledBy,
}: MarkdownEditorProps) {
  const t = useTranslations();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const instanceRef = React.useRef<Vditor | null>(null);
  const [ready, setReady] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  /** 加载失败后点「重试」时自增，让初始化 effect 重新跑一次 */
  const [retryKey, setRetryKey] = React.useState(0);
  const onChangeRef = React.useRef(onChange);
  const lastEmittedRef = React.useRef<string | null>(null);
  const initialValueRef = React.useRef(value);

  onChangeRef.current = onChange;

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { default: VditorClass } = await loadVditor();
        if (cancelled || !containerRef.current) {
          return;
        }

        instanceRef.current = new VditorClass(containerRef.current, {
          cdn: "/vditor",
          height,
          mode: "ir",
          value: initialValueRef.current,
          placeholder,
          cache: { enable: false },
          toolbar: [
            "headings",
            "bold",
            "italic",
            "strike",
            "|",
            "list",
            "ordered-list",
            "check",
            "outdent",
            "indent",
            "|",
            "quote",
            "line",
            "code",
            "inline-code",
            "link",
            "table",
            "|",
            "undo",
            "redo",
            "|",
            "edit-mode",
            "both",
            "fullscreen",
            "preview",
          ],
          after: () => {
            if (!cancelled) {
              setReady(true);
            }
          },
          input: (next: string) => {
            lastEmittedRef.current = next;
            onChangeRef.current(next);
          },
        });
      } catch (error) {
        console.error("[markdown-editor] Vditor 初始化失败：", error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
    // 仅初始化一次（重试时通过 retryKey 重跑）；外部值变化由下面的 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // 外部（例如切换文章、重置表单）改变内容时同步进编辑器，避免光标跳动
  React.useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }
    if (value === lastEmittedRef.current) {
      return;
    }
    if (value !== instance.getValue()) {
      instance.setValue(value);
    }
  }, [value]);

  return (
    <div
      className="relative min-h-[clamp(360px,55vh,560px)]"
      role="group"
      aria-labelledby={ariaLabelledBy}
    >
      <div ref={containerRef} className="vditor-host" />
      {!ready && !loadFailed ? (
        <div
          role="status"
          className="absolute inset-0 z-10 flex min-h-[clamp(360px,55vh,560px)] items-center justify-center rounded-md border border-dashed border-border/70 bg-background/90 text-sm text-muted-foreground"
        >
          {t("posts.editorLoading")}
        </div>
      ) : null}
      {loadFailed ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex min-h-[clamp(360px,55vh,560px)] flex-col items-center justify-center gap-3 rounded-md border border-destructive/40 bg-background/95 p-6 text-center text-sm text-destructive"
        >
          <p>{t("posts.editorLoadFailed")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setReady(false);
              setLoadFailed(false);
              setRetryKey((key) => key + 1);
            }}
          >
            {t("posts.editorRetry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
