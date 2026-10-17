"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 图片加载骨架：图片解码完成前垫一层 shimmer，避免封面位置先空一块再"啪"地出现。
 *
 * 为什么值得做：文章封面是 `loading="lazy"`，滚到可见位置才开始下载 ——
 * 在那之前 `<img>` 是 0 高度（或按 aspect-ratio 撑开但空白），
 * 用户看到的就是卡片上一块突兀的空白。骨架把这段空白变成有意义的加载反馈。
 *
 * 只动 opacity，不撑布局；图片已经在 DOM 里（浏览器缓存命中时 onLoad 会立刻触发）。
 */
export function ImageSkeleton({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!loaded ? <div className="skeleton absolute inset-0" aria-hidden="true" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
      />
    </div>
  );
}

/**
 * 文章卡片骨架：用于分页/筛选切换等"内容还没到"的场景。
 * 尺寸与真实卡片一致（封面 16:9 + 标题两行 + 元信息一行），切换时不会跳版。
 */
export function PostCardSkeleton() {
  return (
    <article className="surface mb-6 flex h-full flex-col overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton mt-3 h-3.5 w-full rounded" />
        <div className="skeleton mt-2 h-3.5 w-2/3 rounded" />
        <div className="mt-auto flex gap-2 pt-4">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-14 rounded" />
        </div>
      </div>
    </article>
  );
}
