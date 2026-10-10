import { defineRouting } from "next-intl/routing";

/**
 * 国际化路由配置。
 * - locales：前台支持的语言
 * - defaultLocale：无匹配时使用的语言
 * - localePrefix: "always" → 所有前台路径都带语言前缀（/zh/...、/en/...）
 *   根路径 `/` 由 next.config.ts 的 301 重定向处理到 /zh
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
