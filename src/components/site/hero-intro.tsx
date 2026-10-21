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
  // 固定引用，避免每次渲染都让 HeroTitle 的 effect 重跑（见 hero-title.tsx 注释）
  const handleTitleDone = React.useCallback(() => setReady(true), []);

  /*
   * 副标题要求「单行完整显示 + 循环打字」，不能靠换行兜底。
   * 但中英文长度差很多（英文平均每字符约 0.56em，中文 1em），固定字号在
   * 375/390 宽手机或长英文副标题下必然溢出，所以按「文字宽度估算 + 视口宽」
   * 反推字号：fontSize = (100vw - 左右留白) / 估算宽度(em)，再 clamp 到
   * [0.9rem, 1.6rem]。这样短句在桌面能放大、长句在手机自动缩小，始终单行。
   */
  const subtitleUnits = React.useMemo(() => {
    let units = 0;
    for (const char of subtitle) {
      if (char === " ") {
        units += 0.32;
      } else if (char.charCodeAt(0) > 0x2e80) {
        units += 1;
      } else {
        units += 0.56;
      }
    }
    return Math.max(units, 1);
  }, [subtitle]);

  const subtitleStyle: React.CSSProperties = {
    fontSize: `clamp(0.9rem, calc((100vw - 2.75rem) / ${subtitleUnits.toFixed(2)}), 1.6rem)`,
    lineHeight: 1.55,
  };

  return (
    <>
      <HeroTitle
        text={name}
        className="max-w-[92vw] text-[2rem] leading-tight text-balance sm:text-6xl"
        onDone={handleTitleDone}
      />

      {/* 副标题：ready 前用同尺寸占位撑住布局，避免出现时把下面顶跳 */}
      <div
        className="transition-opacity duration-500 ease-out motion-reduce:transition-none"
        style={{ opacity: ready ? 1 : 0 }}
        aria-hidden={!ready}
      >
        {subtitle && ready ? (
          <p
            className="hero-subtitle font-display mt-5 whitespace-nowrap text-center sm:mt-7"
            style={subtitleStyle}
          >
            <Typewriter text={subtitle} />
          </p>
        ) : (
          <p className="mt-5 text-center sm:mt-7" aria-hidden="true" style={subtitleStyle}>
            &nbsp;
          </p>
        )}
      </div>

      <a
        href="#home-content"
        className="absolute bottom-28 z-10 flex flex-col items-center gap-1.5 text-white/70 transition-opacity duration-500 hover:text-white sm:bottom-44"
        style={{ opacity: ready ? 1 : 0 }}
        tabIndex={ready ? undefined : -1}
        aria-hidden={!ready}
      >
        <span className="text-[0.75rem] tracking-[0.25em] uppercase">{scrollLabel}</span>
        <ChevronDownIcon className="size-4 animate-bounce" />
      </a>
    </>
  );
}
