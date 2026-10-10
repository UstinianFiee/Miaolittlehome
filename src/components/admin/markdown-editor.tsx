"use client";

import * as React from "react";
import "vditor/dist/index.css";

import type Vditor from "vditor";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** 初始高度 */
  height?: number;
};

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
  height = 560,
}: MarkdownEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const instanceRef = React.useRef<Vditor | null>(null);
  const onChangeRef = React.useRef(onChange);
  const lastEmittedRef = React.useRef<string | null>(null);
  const initialValueRef = React.useRef(value);

  onChangeRef.current = onChange;

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { default: VditorClass } = await import("vditor");
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
        input: (next: string) => {
          lastEmittedRef.current = next;
          onChangeRef.current(next);
        },
      });
    })();

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
    // 仅初始化一次；外部值变化由下面的 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return <div ref={containerRef} className="vditor-host" />;
}
