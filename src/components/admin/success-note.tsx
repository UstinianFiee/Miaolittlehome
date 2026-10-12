"use client";

import { Tick } from "@/components/ui/tick";

/**
 * 后台统一的「操作成功」提示：一个打勾 + 淡入。
 *
 * 原来只是一行 `text-primary` 的小字，很容易被忽略；
 * 加上一笔画出来的对勾后，保存动作有了明确的「完成」手感。
 * 颜色跟随外层（默认 text-primary），不额外引入一套配色。
 */
export function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="page-enter flex items-center gap-1.5 text-sm text-primary">
      <Tick />
      {children}
    </p>
  );
}
