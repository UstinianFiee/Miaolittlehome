/**
 * 站点主题色 / 加载动画主色。
 *
 * 为什么不在 CSS 里写死：
 * - 主题色存在数据库里，后台改完要立刻生效，不能靠重新构建；
 * - 只在用户改过颜色时才注入一段 CSS 变量，保持默认主题零改动；
 * - 只把「品牌色派生变量」整体接过来：不只是按钮/链接的强调色，还包括
 *   页面底色、卡片、边框、输入框、气泡、便签纸、导航底、遮罩等结构性颜色，
 *   否则会出现「按钮紫了、背景还是绿的」这种割裂感。
 *   文字/背景都由品牌色和中性色按低比例混合，保持对比度。
 */

export const DEFAULT_THEME_COLOR = "#39c5bb";
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** 按 `share` 取 a，其余取 b（sRGB 线性近似即可，派生色不需要绝对精确）。 */
function mix(a: string, b: string, share: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex([
    ar * share + br * (1 - share),
    ag * share + bg * (1 - share),
    ab * share + bb * (1 - share),
  ]);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

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
 * - `themeColor` 不是默认色时，输出 :root / .dark 两套完整派生色；
 * - `preloaderColor` 有值时只输出 --preloader-accent（加载动画单独用色）；
 * - 两者都没有（或都是默认值）时返回 null，完全不注入，默认主题保持不变。
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
    const brand = themeColor;

    /*
     * 浅色：所有浅色面都由「品牌色 + 白」低比例混合，保留品牌色相；
     * primary 用「品牌色 + 深黑」压暗，保证浅底上的文字/按钮对比度。
     */
    blocks.push(
      `:root{--brand:${brand};` +
        `--brand-soft:${rgba(brand, 0.12)};` +
        `--brand-tint:${rgba(brand, 0.06)};` +
        `--brand-line:${rgba(brand, 0.32)};` +
        `--brand-glow:${rgba(brand, 0.28)};` +
        `--brand-ink:${mix(brand, "#00100f", 0.16)};` +
        `--primary:${mix(brand, "#021413", 0.42)};` +
        "--primary-foreground:#ffffff;" +
        `--accent:${rgba(brand, 0.12)};` +
        `--accent-foreground:${mix(brand, "#021413", 0.48)};` +
        `--secondary:${mix(brand, "#ffffff", 0.1)};` +
        `--secondary-foreground:${mix(brand, "#182a2c", 0.05)};` +
        `--tone-mint-bg:${mix(brand, "#ffffff", 0.1)};` +
        `--player-ring-soft:${mix(brand, "#ffffff", 0.4)};` +
        // 页面骨架色：低比例品牌色，避免「主题紫、页面绿」
        `--background:${mix(brand, "#ffffff", 0.055)};` +
        `--foreground:${mix(brand, "#182a2c", 0.055)};` +
        `--card:${mix(brand, "#ffffff", 0.02)};` +
        `--card-foreground:${mix(brand, "#123a3d", 0.05)};` +
        `--popover:${mix(brand, "#ffffff", 0.025)};` +
        `--popover-foreground:${mix(brand, "#123a3d", 0.05)};` +
        `--muted:${mix(brand, "#ffffff", 0.07)};` +
        `--muted-foreground:${mix(brand, "#3f5a5e", 0.12)};` +
        `--border:${mix(brand, "#ffffff", 0.2)};` +
        `--input:${mix(brand, "#ffffff", 0.38)};` +
        `--input-bg:${mix(brand, "#ffffff", 0.08)};` +
        `--sidebar:${mix(brand, "#ffffff", 0.05)};` +
        `--bubble-bg:${mix(brand, "#ffffff", 0.05)};` +
        `--bubble-border:${mix(brand, "#ffffff", 0.24)};` +
        `--bubble-foreground:${mix(brand, "#173033", 0.08)};` +
        `--bubble-muted:${mix(brand, "#455f63", 0.14)};` +
        `--note-paper:${mix(brand, "#ffffff", 0.02)};` +
        `--nav-bg:color-mix(in srgb,var(--brand) 3%,rgb(255 255 255 / 0.95));` +
        `--surface-raised:color-mix(in srgb,var(--brand) 2%,rgb(255 255 255 / 0.98));` +
        `--reading-bg:color-mix(in srgb,var(--brand) 2%,rgb(255 255 255 / 0.97));}`
    );

    /*
     * 深色：卡片/边框/气泡在深底上叠少量品牌色；primary 直接用品牌色本身，
     * 文字用深墨，保证亮色按钮上的可读性。
     */
    blocks.push(
      `.dark{--brand:${brand};` +
        `--brand-soft:${rgba(brand, 0.16)};` +
        `--brand-tint:${rgba(brand, 0.08)};` +
        `--brand-line:${rgba(brand, 0.42)};` +
        `--brand-glow:${rgba(brand, 0.38)};` +
        `--brand-ink:${mix(brand, "#00100f", 0.16)};` +
        "--primary:var(--brand);" +
        `--primary-foreground:${mix(brand, "#00100f", 0.16)};` +
        `--accent:${rgba(brand, 0.14)};` +
        `--accent-foreground:${mix(brand, "#ffffff", 0.7)};` +
        `--secondary:${mix(brand, "#122a2d", 0.12)};` +
        `--secondary-foreground:${mix(brand, "#d4e8e7", 0.05)};` +
        `--tone-mint-bg:${mix(brand, "#0d2426", 0.1)};` +
        `--player-ring-soft:${mix(brand, "#ffffff", 0.55)};` +
        `--background:${mix(brand, "#090909", 0.045)};` +
        `--foreground:${mix(brand, "#d4e8e7", 0.05)};` +
        `--card:${mix(brand, "#142a2d", 0.12)};` +
        `--card-foreground:${mix(brand, "#eef9f8", 0.04)};` +
        `--popover:${mix(brand, "#1a3336", 0.12)};` +
        `--popover-foreground:${mix(brand, "#eef9f8", 0.04)};` +
        `--muted:${mix(brand, "#1b3437", 0.12)};` +
        `--muted-foreground:${mix(brand, "#a9c8c7", 0.1)};` +
        `--border:${mix(brand, "#31575a", 0.2)};` +
        `--input:${mix(brand, "#4f797b", 0.25)};` +
        `--input-bg:${mix(brand, "#0d1a1c", 0.1)};` +
        `--sidebar:${mix(brand, "#12282b", 0.1)};` +
        `--bubble-bg:${mix(brand, "#13383a", 0.12)};` +
        `--bubble-border:${mix(brand, "#3d7d7c", 0.22)};` +
        `--bubble-foreground:${mix(brand, "#e3f8f5", 0.045)};` +
        `--bubble-muted:${mix(brand, "#acd2d1", 0.1)};` +
        `--note-paper:${mix(brand, "#1e3639", 0.1)};` +
        `--nav-bg:color-mix(in srgb,var(--brand) 4%,rgb(16 22 24 / 0.97));` +
        `--surface-raised:color-mix(in srgb,var(--brand) 5%,rgb(16 22 24 / 0.98));` +
        `--reading-bg:color-mix(in srgb,var(--brand) 4%,rgb(16 22 24 / 0.97));}`
    );
  }

  if (preloaderColor) {
    blocks.push(`:root{--preloader-accent:${preloaderColor}}`);
  }

  return blocks.join("\n");
}
