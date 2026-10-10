/**
 * 从 simple-icons（devDependency）生成品牌图标数据模块。
 *
 * 为什么生成而不是运行时依赖：
 *   站点只需要几十个图标，而 simple-icons 全量有 3000+ 个。
 *   生成成静态数据后，**运行时不引入任何新依赖**，产物也只包含用到的路径。
 *   需要增删图标时：改下面的 ICONS 列表 → `node scripts/gen-brand-icons.mjs`。
 *
 * 用法：node scripts/gen-brand-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.join("node_modules", "simple-icons", "icons");
const OUT_FILE = path.join("src", "components", "site", "profile-icon.tsx");

/** [simple-icons 文件名, 本站图标 key, 显示名] */
const ICONS = [
  ["github", "github", "GitHub"],
  ["gitlab", "gitlab", "GitLab"],
  ["gitee", "gitee", "Gitee"],
  ["bilibili", "bilibili", "哔哩哔哩"],
  ["x", "x", "X"],
  ["telegram", "telegram", "Telegram"],
  ["sinaweibo", "weibo", "微博"],
  ["zhihu", "zhihu", "知乎"],
  ["juejin", "juejin", "掘金"],
  ["csdn", "csdn", "CSDN"],
  ["v2ex", "v2ex", "V2EX"],
  ["douban", "douban", "豆瓣"],
  ["tiktok", "tiktok", "抖音 / TikTok"],
  ["kuaishou", "kuaishou", "快手"],
  ["xiaohongshu", "xiaohongshu", "小红书"],
  ["wechat", "wechat", "微信"],
  ["qq", "qq", "QQ"],
  ["neteasecloudmusic", "neteasecloudmusic", "网易云音乐"],
  ["spotify", "spotify", "Spotify"],
  ["youtube", "youtube", "YouTube"],
  ["twitch", "twitch", "Twitch"],
  ["discord", "discord", "Discord"],
  ["steam", "steam", "Steam"],
  ["reddit", "reddit", "Reddit"],
  ["mastodon", "mastodon", "Mastodon"],
  ["bluesky", "bluesky", "Bluesky"],
  ["threads", "threads", "Threads"],
  ["instagram", "instagram", "Instagram"],
  ["facebook", "facebook", "Facebook"],
  ["notion", "notion", "Notion"],
  ["pixiv", "pixiv", "Pixiv"],
  ["medium", "medium", "Medium"],
  ["wordpress", "wordpress", "WordPress"],
  ["rss", "rss", "RSS"],
];

/** 通用图标（走 lucide-react，不需要路径数据）。 */
const GENERIC = [
  ["link", "链接"],
  ["mail", "邮箱"],
  ["globe", "网站"],
  ["user", "个人"],
  ["code", "代码"],
  ["music", "音乐"],
  ["book", "阅读"],
  ["heart", "喜欢"],
  ["camera", "摄影"],
  ["image", "图片"],
  ["message-circle", "聊天"],
  ["star", "收藏"],
  ["home", "主页"],
  ["gamepad-2", "游戏"],
  ["briefcase", "工作"],
  ["pen-line", "写作"],
];

function extractPath(slug) {
  const file = path.join(SRC_DIR, `${slug}.svg`);
  if (!fs.existsSync(file)) {
    throw new Error(`图标不存在：${slug}.svg`);
  }
  const svg = fs.readFileSync(file, "utf8");
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length === 0) {
    throw new Error(`未从 ${slug}.svg 中解析到 path`);
  }
  return paths;
}

const brandEntries = ICONS.map(([slug, key, label]) => ({
  key,
  label,
  paths: extractPath(slug),
}));

const genericKeys = GENERIC.map(([key]) => key);

const pathLines = brandEntries
  .map(({ key, paths }) => {
    const body = paths.map((d) => `    ${JSON.stringify(d)},`).join("\n");
    return `  ${key}: [\n${body}\n  ],`;
  })
  .join("\n");

const labelLines = [
  ...brandEntries.map(({ key, label }) => `  ${key}: ${JSON.stringify(label)},`),
  ...GENERIC.map(([key, label]) => `  ${JSON.stringify(key)}: ${JSON.stringify(label)},`),
].join("\n");

const genericLines = genericKeys.map((k) => `  ${JSON.stringify(k)},`).join("\n");

const out = `/* 本文件由 scripts/gen-brand-icons.mjs 自动生成，请勿手动修改。 */
/* 图标来源：simple-icons（CC0-1.0）。通用图标走 lucide-react。 */

import {
  BookIcon,
  BriefcaseIcon,
  CameraIcon,
  CodeIcon,
  Gamepad2Icon,
  GlobeIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  MusicIcon,
  PenLineIcon,
  StarIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";

/** 品牌图标的路径数据（viewBox 0 0 24 24，单色填充）。 */
const BRAND_PATHS: Record<string, readonly string[]> = {
${pathLines}
};

/** 通用图标（非品牌），走 lucide。 */
const GENERIC_ICONS: Record<string, LucideIcon> = {
  link: LinkIcon,
  mail: MailIcon,
  globe: GlobeIcon,
  user: UserIcon,
  code: CodeIcon,
  music: MusicIcon,
  book: BookIcon,
  heart: HeartIcon,
  camera: CameraIcon,
  image: ImageIcon,
  "message-circle": MessageCircleIcon,
  star: StarIcon,
  home: HomeIcon,
  "gamepad-2": Gamepad2Icon,
  briefcase: BriefcaseIcon,
  "pen-line": PenLineIcon,
};

/** 通用图标的 key（顺序与后台选择器一致）。 */
const GENERIC_KEYS: readonly string[] = [
${genericLines}
];

/** 全部可选图标 key。 */
export const ICON_KEYS: readonly string[] = [
  ...Object.keys(BRAND_PATHS),
  ...GENERIC_KEYS,
];

/** 图标显示名，用于后台选择器与前台兜底文案。 */
export const ICON_LABELS: Record<string, string> = {
${labelLines}
};

/** 图标 key → 显示名；未知 key 原样返回。 */
export function iconLabel(key: string): string {
  return ICON_LABELS[key] ?? key;
}

/** 判断某个 key 是否是品牌图标。 */
export function isBrandIcon(key: string): boolean {
  return key in BRAND_PATHS;
}

/**
 * 渲染一个资料链接图标。
 * 品牌图标用官方 SVG 路径（单色，随 currentColor）；通用图标用 lucide。
 * 未知 key 回退到「链接」图标，保证永远画得出来。
 */
export function ProfileIcon({ name, className }: { name: string; className?: string }) {
  const paths = BRAND_PATHS[name];

  if (paths) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        {paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    );
  }

  const Icon = GENERIC_ICONS[name] ?? LinkIcon;
  return <Icon className={className} aria-hidden="true" />;
}
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out, "utf8");

const bytes = Buffer.byteLength(out, "utf8");
console.log(
  `已生成 ${OUT_FILE}：品牌 ${brandEntries.length} 个 + 通用 ${genericKeys.length} 个，${(
    bytes / 1024
  ).toFixed(1)}KB`
);
