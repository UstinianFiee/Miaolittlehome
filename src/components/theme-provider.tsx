"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * 日夜主题 Provider（next-themes）。
 * 通过 `attribute="class"` 在 <html> 上切换 `dark` 类，与 globals.css 的 .dark 变量对应。
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
