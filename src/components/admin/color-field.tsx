"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * 颜色选择字段：原生色盘 + #RRGGBB 文本框 + 恢复默认。
 *
 * 用原生 `<input type="color">` 而不是引入取色器依赖：
 * 浏览器自带色盘/吸管（支持时），并且提交的格式就是 #rrggbb，后端只需校验正则。
 * 文本框允许直接粘贴设计稿色值；清空表示「用默认 / 跟随主题色」。
 */
export function ColorField({
  id,
  label,
  hint,
  value,
  fallback,
  resetLabel,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  /** 输入框为空时色盘展示的默认色 */
  fallback: string;
  resetLabel: string;
  onChange: (next: string) => void;
}) {
  const pickerValue = HEX_PATTERN.test(value) ? value : fallback;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={pickerValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={7}
          placeholder={fallback}
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="press shrink-0"
            onClick={() => onChange("")}
          >
            {resetLabel}
          </Button>
        ) : null}
      </div>

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
