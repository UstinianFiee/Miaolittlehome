"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 电梯式浮动标签输入框。
 *
 * 标签**从不消失**：空且未聚焦时停在输入框正中，一旦聚焦或有内容就整体上浮并缩小，
 * 像坐电梯上去停在顶层。相比「placeholder 一输入就没了」，用户始终知道这一栏是什么。
 *
 * 结构上有硬性要求：`children` 必须是**直接**渲染出 `<input>` 的元素
 * （shadcn 的 `Input` 满足），且 `<input>` 需要 `placeholder=" "`——
 * 浮动逻辑靠 `:not(:placeholder-shown)` 判断有没有内容。
 * `<label>` 必须排在 `<input>` 之后，CSS 用的是相邻兄弟选择器。
 */
export function ElevatorField({
  id,
  label,
  children,
  adornment,
  invalid,
  shake,
  className,
}: {
  id: string;
  label: string;
  /** 必须直接渲染一个 <input>（且带 placeholder=" "） */
  children: React.ReactNode;
  /** 输入框右侧的角标（打勾、强度文字等） */
  adornment?: React.ReactNode;
  invalid?: boolean;
  /** 为 true 时触发一次轻晃；每次出错要用新对象/新 key 让它重新播放 */
  shake?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("elevator-field", shake && "field-shake", className)}>
      {children}
      <label htmlFor={id} className="elevator-label text-sm">
        {label}
      </label>
      {adornment ? <span className="field-adornment">{adornment}</span> : null}
      {invalid ? <span className="sr-only">{label} 输入有误</span> : null}
    </div>
  );
}
