/**
 * 站点主题色 / 加载动画主色。
 *
 * 为什么不在 CSS 里写死：
 * - 主题色存在数据库里，后台改完要立刻生效，不能靠重新构建；
 * - 只在用户改过颜色时才注入一段 CSS 变量，保持默认主题零改动；
 * - 只把「品牌色派生变量」接过来（主色、强调色、浅色底、光晕等），
 *   背景/文字/边框仍走原来的中性色，保证可读性和对比度。
 */

export const DEFAULT_THEME_COLOR = "#39c5bb";
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

/** 校验并规范化 #RRGGBB；不合法返回 null（调用方决定回退）。 */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return HEX_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * 生成主题覆盖 CSS：
 * - `themeColor` 不是默认色时，输出 :root / .dark 两套品牌派生变量；
 * - `preloaderColor` 有值时只输出 --preloader-accent（加载动画单独用色）；
 * - 两者都没有（或都是默认值）时返回 null，完全不注入，默认主题保持不变。
 *
 * 用 color-mix 现算派生色，而不是在 TypeScript 里手写色彩空间换算；
 * 这样明暗主题可以各自调整透明度/混合底色，也能跟着所选颜色自然变化。
 */
export function buildThemeCss(themeColorRaw: string, preloaderColorRaw: string): string | null {
  const themeColor = normalizeHexColor(themeColorRaw);
  const preloaderColor = normalizeHexColor(preloaderColorRaw);
  const customTheme = themeColor !== null && themeColor !== DEFAULT_THEME_COLOR;

  if (!customTheme && !preloaderColor) {
    return null;
  }

  const blocks: string[] = [];

  if (customTheme) {
    // 浅色主题：品牌色 + 同色系深色（primary 用于文字/按钮，要保证浅底对比度）
    blocks.push(
      `:root{--brand:${themeColor};` +
        "--brand-soft:color-mix(in srgb,var(--brand) 12%,transparent);" +
        "--brand-tint:color-mix(in srgb,var(--brand) 6%,transparent);" +
        "--brand-line:color-mix(in srgb,var(--brand) 32%,transparent);" +
        "--brand-glow:color-mix(in srgb,var(--brand) 28%,transparent);" +
        "--brand-ink:color-mix(in oklab,var(--brand) 16%,#00100f);" +
        "--primary:color-mix(in oklab,var(--brand) 42%,#021413);" +
        "--primary-foreground:#ffffff;" +
        "--accent:color-mix(in srgb,var(--brand) 12%,transparent);" +
        "--accent-foreground:color-mix(in oklab,var(--brand) 48%,#021413);" +
        "--secondary:color-mix(in srgb,var(--brand) 12%,#ffffff);" +
        "--tone-mint-bg:color-mix(in srgb,var(--brand) 12%,#ffffff);" +
        "--player-ring-soft:color-mix(in srgb,var(--brand) 40%,#ffffff);}"
    );

    // 深色主题：品牌色本身当 primary（深底上对比够），文字用深色墨
    blocks.push(
      `.dark{--brand:${themeColor};` +
        "--brand-soft:color-mix(in srgb,var(--brand) 16%,transparent);" +
        "--brand-tint:color-mix(in srgb,var(--brand) 8%,transparent);" +
        "--brand-line:color-mix(in srgb,var(--brand) 42%,transparent);" +
        "--brand-glow:color-mix(in srgb,var(--brand) 38%,transparent);" +
        "--brand-ink:color-mix(in oklab,var(--brand) 12%,#00100f);" +
        "--primary:var(--brand);" +
        "--primary-foreground:color-mix(in oklab,var(--brand) 16%,#00100f);" +
        "--accent:color-mix(in srgb,var(--brand) 14%,transparent);" +
        "--accent-foreground:color-mix(in oklab,var(--brand) 70%,#ffffff);" +
        "--secondary:color-mix(in oklab,var(--brand) 12%,#122a2d);" +
        "--tone-mint-bg:color-mix(in oklab,var(--brand) 10%,#0d2426);" +
        "--player-ring-soft:color-mix(in srgb,var(--brand) 55%,#ffffff);}"
    );
  }

  if (preloaderColor) {
    blocks.push(`:root{--preloader-accent:${preloaderColor}}`);
  }

  return blocks.join("\n");
}
