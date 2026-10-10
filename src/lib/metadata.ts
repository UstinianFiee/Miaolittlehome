import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { defaultLocale, locales } from "@/i18n/routing";

/**
 * 生成 hreflang / canonical。
 * @param locale 当前语言
 * @param path 去掉语言前缀的路径，例如 "" 或 "/posts"
 */
export function buildAlternates(locale: string, path = ""): Metadata["alternates"] {
  const suffix = path === "/" ? "" : path;

  const languages: Record<string, string> = {};
  for (const item of locales) {
    languages[item] = `/${item}${suffix}`;
  }
  languages["x-default"] = `/${defaultLocale}${suffix}`;

  return {
    canonical: `/${locale}${suffix}`,
    languages,
  };
}

/** 页面级 metadata：标题走文案 key，并带上 canonical / hreflang。 */
export async function buildPageMetadata({
  locale,
  path,
  titleKey,
}: {
  locale: string;
  path: string;
  titleKey: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale });

  return {
    title: t(titleKey),
    alternates: buildAlternates(locale, path),
  };
}
