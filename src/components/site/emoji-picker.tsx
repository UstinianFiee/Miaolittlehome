"use client";

import { SmileIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EMOJI_GROUPS, insertEmojiAtCursor } from "@/lib/emojis";
import { cn } from "@/lib/utils";

/**
 * 表情选择器：点图标在弹出的面板里挑，插入到指定 textarea 的光标处。
 *
 * 面板用的是受控的绝对定位浮层（不用 Popover 原语）——
 * 评论表单在页面里可能出现多次（正文 / 回复），原语的定位上下文容易打架。
 */
export function EmojiPicker({
  textareaId,
  label,
  align = "left",
}: {
  textareaId: string;
  label: string;
  align?: "left" | "right";
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // 点外面 / 按 Esc 收起
  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="press inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <SmileIcon className="size-4" />
      </button>

      {open ? (
        <div
          className={cn(
            "emoji-pop absolute bottom-full z-50 mb-2 w-[16.5rem] max-w-[calc(100vw-2rem)] rounded-lg border border-border/60 bg-background p-2 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.key} className="mb-1.5 last:mb-0">
              <p className="px-1 pb-1 text-[0.7rem] text-muted-foreground">
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
        </div>
      ) : null}
    </div>
  );
}
