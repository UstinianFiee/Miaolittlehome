"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { HeroTitle } from "@/components/site/hero-title";
import { Typewriter } from "@/components/site/typewriter";

/**
 * 封面标题区的入场编排：**站点名逐字显现 → 落定收尾 → 才放出副标题和下滑箭头**。
 *
 * 抽成 client 组件是因为要持有 `ready` 状态（HomeView 本身是 server component）。
 * 副标题的打字机只在 ready 后挂载 —— 否则它会站在站点名还在冒字的时候就开始打，
 * 两个动效抢镜，就是"太杂"的来源之一。
 */
export function HeroIntro({
  name,
  subtitle,
  scrollLabel,
}: {
  name: string;
  subtitle: string;
  scrollLabel: string;
}) {
  const [ready, setReady] = React.useState(false);

  return (
    <>
      <HeroTitle
        text={name}
        className="max-w-4xl text-4xl leading-tight text-balance sm:text-6xl"
        onDone={() => setReady(true)}
      />

      {/* 副标题：ready 前用同尺寸占位撑住布局，避免出现时把下面顶跳 */}
      <div
        className="transition-opacity duration-500 ease-out motion-reduce:transition-none"
        style={{ opacity: ready ? 1 : 0 }}
        aria-hidden={!ready}
      >
        {subtitle && ready ? (
          <p className="hero-subtitle font-display mt-6 text-lg sm:text-2xl">
            <Typewriter text={subtitle} />
          </p>
        ) : (
          <p className="mt-6 text-lg sm:text-2xl" aria-hidden="true">
            &nbsp;
          </p>
        )}
      </div>

      <a
        href="#home-content"
        className="absolute bottom-24 z-10 flex flex-col items-center gap-1.5 text-white/70 transition-opacity duration-500 hover:text-white sm:bottom-40"
        style={{ opacity: ready ? 1 : 0 }}
        tabIndex={ready ? undefined : -1}
        aria-hidden={!ready}
      >
        <span className="text-[0.7rem] tracking-[0.25em] uppercase">{scrollLabel}</span>
        <ChevronDownIcon className="size-4 animate-bounce" />
      </a>
    </>
  );
}
