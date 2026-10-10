"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

/** 北京时间固定为 UTC+8，与浏览器所在时区无关。 */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type GreetingKey = "morning" | "noon" | "afternoon" | "evening" | "night";

/** 按北京时间的小时数挑选问候语。 */
function pickGreeting(hour: number): GreetingKey {
  if (hour >= 5 && hour <= 10) return "morning";
  if (hour >= 11 && hour <= 13) return "noon";
  if (hour >= 14 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 22) return "evening";
  return "night";
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * 北京时间问候语：早上好呀 / 中午好呀 / 下午好呀 …
 *
 * 只能在客户端计算——服务端渲染时算出来的时间会被 ISR 缓存住，
 * 那样问候语就会一直停在构建时刻。
 * 首次渲染（含服务端）统一输出占位符，挂载后再写入，避免 hydration 不一致。
 */
export function Greeting({ locale }: { locale: string }) {
  const t = useTranslations();
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + BEIJING_OFFSET_MS));
    tick();
    // 半分钟刷新一次即可覆盖跨小时 / 跨分钟的切换
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const isZh = locale.startsWith("zh");
  const greeting = now ? t(`greeting.${pickGreeting(now.getUTCHours())}`) : "\u00A0";
  const time = now
    ? `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
      `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} ` +
      (isZh ? WEEKDAY_ZH[now.getUTCDay()] : WEEKDAY_EN[now.getUTCDay()])
    : "\u00A0";

  return (
    <div>
      <p className="font-display text-xl leading-snug sm:text-2xl">{greeting}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("greeting.beijingTime")} {time}
      </p>
    </div>
  );
}
