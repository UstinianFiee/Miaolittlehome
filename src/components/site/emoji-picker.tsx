"use client";

import { SmileIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { createPortal } from "react-dom";

import { EMOJI_GROUPS, insertEmojiAtCursor } from "@/lib/emojis";
import { cn } from "@/lib/utils";

/** 面板宽度（rem）：与原来 16.5rem 一致，窄屏自动收窄到视口内 */
const PANEL_WIDTH_REM = 16.5;
/** 面板与视口边缘至少留出的距离（px） */
const VIEWPORT_MARGIN = 12;

type PanelPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

/**
 * 表情选择器：点图标在弹层里挑，插入到指定 textarea 的光标处。
 *
 * 弹层用 **portal + fixed 定位**（不再相对按钮 absolute）：
 * - 评论表单在页面里可能出现多次，外层卡片/滚动容器可能有 overflow 裁剪；
 * - 相对按钮定位时，手机 375/390 宽度下弹层会跑到视口左侧外面
 *   （实测 left = -150，近一半表情点不到）；
 * - 改成 fixed 后按按钮位置计算并夹在视口内，任何宽度都不会被裁。
 */
export function EmojiPicker({
  textareaId,
  label,
}: {
  textareaId: string;
  label: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<PanelPosition | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // 点外面 / 按 Esc 收起（面板 portal 到了 body，所以两处都要判断）
  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * 根据触发按钮的位置计算弹层坐标：
   * 水平优先向右展开，放不下改右对齐，最后夹在安全边距内；
   * 垂直上空位够就向上弹，否则放到按钮下方并按剩余空间压缩高度（内部滚动）。
   */
  const updatePosition = React.useCallback(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) {
      return;
    }

    const rootFontSize =
      parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 17;
    const width = Math.min(
      PANEL_WIDTH_REM * rootFontSize,
      window.innerWidth - VIEWPORT_MARGIN * 2
    );
    const panelHeight = panel.offsetHeight || 340;
    const rect = root.getBoundingClientRect();

    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
      left = rect.right - width;
    }
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
    );

    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const above = spaceAbove >= Math.min(panelHeight, window.innerHeight * 0.7);
    const top = above
      ? Math.max(VIEWPORT_MARGIN, rect.top - 8 - panelHeight)
      : Math.min(
          rect.bottom + 8,
          window.innerHeight - VIEWPORT_MARGIN - 180
        );
    const maxHeight = above
      ? Math.min(panelHeight, spaceAbove)
      : Math.max(180, Math.min(panelHeight, window.innerHeight - rect.bottom - 16));

    setPosition({ left, top, width, maxHeight });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    // 面板先以 visibility:hidden 渲染，量到真实高度后再定位，避免闪一下
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="press inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-8"
      >
        <SmileIcon className="size-4" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              data-testid="emoji-pop"
              style={
                position
                  ? {
                      left: position.left,
                      top: position.top,
                      width: position.width,
                      maxHeight: position.maxHeight,
                    }
                  : {
                      left: 0,
                      top: 0,
                      width: PANEL_WIDTH_REM * 17,
                      visibility: "hidden",
                    }
              }
              className={cn(
                "emoji-pop fixed z-[80] overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-background p-2 shadow-lg"
              )}
            >
              {EMOJI_GROUPS.map((group) => (
                <div key={group.key} className="mb-1.5 last:mb-0">
                  <p className="px-1 pb-1 text-[0.8rem] text-muted-foreground">
                    {t(`comments.emojiGroup.${group.key}`)}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {group.items.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        // 每个都带 aria-label，读屏用户能知道选的是什么
                        aria-label={emoji}
                        onClick={() => insertEmojiAtCursor(textareaId, emoji)}
                        className="press flex aspect-square items-center justify-center rounded text-lg leading-none transition-colors hover:bg-accent"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
