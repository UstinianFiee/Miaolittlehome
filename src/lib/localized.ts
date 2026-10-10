/**
 * 内容语言回退（docs/SPEC.md）：文章 titleEn / summaryEn / contentEn 未填时使用中文。
 * 初期只写中文内容，英文字段留空即自动回退。
 */
export function pickLocalized(locale: string, zh: string, en?: string | null): string {
  if (locale === "en" && typeof en === "string" && en.trim().length > 0) {
    return en;
  }
  return zh;
}
