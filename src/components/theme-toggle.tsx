"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

/** 日夜主题：点击直接在明暗之间切换（不再弹下拉）。 */
export function ThemeToggle() {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const [switching, setSwitching] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function toggle() {
    if (switching) return;
    setSwitching(true);
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    timer.current = setTimeout(() => setSwitching(false), 420);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t("actions.toggleTheme")}
      data-switching={switching}
      data-testid="theme-switch"
      className="press switch-control"
    >
      {/* 图标用 CSS 的 dark: 变体切换，避免读取 resolvedTheme 造成水合不一致 */}
      <SunIcon aria-hidden className="theme-sun size-[1.05rem]" />
      <MoonIcon aria-hidden className="theme-moon size-[1.05rem]" />
    </Button>
  );
}
