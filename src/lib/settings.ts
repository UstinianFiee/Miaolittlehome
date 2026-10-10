import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/prisma";

/**
 * 站点设置（Setting 表 key-value）。
 * 关于页需要的头像 / 简介 / 社交链接都以 `profile.*` 与 `social.*` 存储。
 */

export const SITE_NAME_KEY = "site.name";
export const SITE_AUTHOR_KEY = "site.author";
export const SITE_DESCRIPTION_KEY = "site.description";
export const SITE_LOGO_KEY = "site.logo";
/** 单张首页背景图（旧字段，保留兼容；新配置写进 site.backgrounds）。 */
export const SITE_BACKGROUND_KEY = "site.background";
/** 首页背景图轮播，存 JSON 字符串数组。 */
export const SITE_BACKGROUNDS_KEY = "site.backgrounds";
/** 首页背景视频；设置后优先于图片轮播。 */
export const SITE_BACKGROUND_VIDEO_KEY = "site.backgroundVideo";
export const SITE_SUBTITLE_KEY = "site.subtitle";
/** 内容区背景：首页封面下方与各内页 */
export const SITE_PAGE_BACKGROUND_KEY = "site.pageBackground";
/** 文章详情页背景（留空则沿用内容区背景） */
export const SITE_POST_BACKGROUND_KEY = "site.postBackground";
/** 浏览器页签图标 */
export const SITE_FAVICON_KEY = "site.favicon";
/** 备案号（页脚底部展示；留空则整块不渲染） */
export const SITE_ICP_KEY = "site.icp";
/** 备案号链接（工信部查询页） */
export const SITE_ICP_LINK_KEY = "site.icpLink";

export const PROFILE_NAME_KEY = "profile.name";
export const PROFILE_AVATAR_KEY = "profile.avatar";
export const PROFILE_BIO_KEY = "profile.bio";
/** 自定义链接列表，存 JSON 字符串（见 ProfileLink）。 */
export const PROFILE_LINKS_KEY = "profile.links";
export const SOCIAL_PREFIX = "social.";

/** 旧版固定社交字段；仅用于把历史数据迁移成自定义链接。 */
export const SOCIAL_KEYS = ["github", "email", "bilibili", "x", "telegram", "weibo"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** 一条自定义链接：图标 + 文字 + 地址。 */
export type ProfileLink = {
  /** 图标标识，取值见 `@/components/site/brand-icons` 的 ICON_KEYS。 */
  icon: string;
  /** 显示文字；留空时前台用图标名兜底。 */
  label: string;
  /** 链接地址；email 图标可只填邮箱地址，前台会自动补 mailto:。 */
  url: string;
};

export type ProfileSettings = {
  /** 个人显示名；留空则回退到站点名。 */
  name: string;
  avatar: string;
  bio: string;
  links: ProfileLink[];
};

const LEGACY_SOCIAL_META: Record<SocialKey, { icon: string; label: string }> = {
  github: { icon: "github", label: "GitHub" },
  email: { icon: "email", label: "Email" },
  bilibili: { icon: "bilibili", label: "Bilibili" },
  x: { icon: "x", label: "X" },
  telegram: { icon: "telegram", label: "Telegram" },
  weibo: { icon: "weibo", label: "微博" },
};

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ select: { key: true, value: true } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

/** 解析自定义链接；格式不合法时返回空数组（不抛错，避免脏数据拖垮前台）。 */
function parseLinks(raw: string | undefined): ProfileLink[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        icon: typeof item.icon === "string" ? item.icon : "link",
        label: typeof item.label === "string" ? item.label : "",
        url: typeof item.url === "string" ? item.url : "",
      }))
      .filter((item) => item.url.trim().length > 0);
  } catch {
    return [];
  }
}

/** 把旧版 social.* 转成自定义链接，保证历史数据不丢。 */
function legacyLinks(settings: Record<string, string>): ProfileLink[] {
  return SOCIAL_KEYS.flatMap((key) => {
    const url = settings[`${SOCIAL_PREFIX}${key}`]?.trim();
    if (!url) {
      return [];
    }
    const meta = LEGACY_SOCIAL_META[key];
    return [{ icon: meta.icon, label: meta.label, url }];
  });
}

/**
 * 读取关于页所需的资料；缺失项返回空串 / 空数组，前台按「不填不显示」处理。
 *
 * `profile.links` **存在**（哪怕是 `[]`）就以它为准；只有该键完全不存在时，
 * 才回退到旧版 `social.*`，这样用户在后台清空链接后不会被历史数据「复活」。
 */
export async function getProfile(): Promise<ProfileSettings> {
  const settings = await getAllSettings();
  const rawLinks = settings[PROFILE_LINKS_KEY];

  return {
    name: settings[PROFILE_NAME_KEY]?.trim() || "",
    avatar: settings[PROFILE_AVATAR_KEY] ?? "",
    bio: settings[PROFILE_BIO_KEY] ?? "",
    links: rawLinks === undefined ? legacyLinks(settings) : parseLinks(rawLinks),
  };
}

/**
 * 站点基本信息；未配置时回退到 config/site.ts 的默认值。
 * logo / background 为空表示未设置，前台按「无图则回退」处理。
 */
export type SiteInfo = {
  name: string;
  author: string;
  description: string;
  subtitle: string;
  logo: string;
  /** 单张首页背景图（= backgrounds[0]，保留给旧调用点）。 */
  background: string;
  /** 首页背景图列表；多张时前台轮播。 */
  backgrounds: string[];
  /** 首页背景视频；非空时前台用视频，忽略图片。 */
  backgroundVideo: string;
  pageBackground: string;
  postBackground: string;
  /** 页签图标：单独设置优先，未设置时回退到 Logo。 */
  favicon: string;
  /** 备案号；为空表示未备案，页脚不显示备案区。 */
  icp: string;
  /** 备案号链接。 */
  icpLink: string;
};

/** 解析背景图列表；兼容旧的单图字段。 */
function parseBackgrounds(raw: string | undefined, legacy: string): string[] {
  const fromJson = (() => {
    if (!raw) {
      return [] as string[];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [] as string[];
      }
      return parsed.filter((item): item is string => typeof item === "string").map((s) => s.trim());
    } catch {
      return [] as string[];
    }
  })().filter((item) => item.length > 0);

  // 新字段存在（哪怕是 []）就以它为准；只有完全没写过时才回退到旧单图字段
  if (raw !== undefined) {
    return fromJson;
  }
  return legacy ? [legacy] : [];
}

export async function getSiteInfo(): Promise<SiteInfo> {
  const settings = await getAllSettings();
  const logo = settings[SITE_LOGO_KEY]?.trim() || "";
  const favicon = settings[SITE_FAVICON_KEY]?.trim() || "";
  const legacyBackground = settings[SITE_BACKGROUND_KEY]?.trim() || "";
  const backgrounds = parseBackgrounds(settings[SITE_BACKGROUNDS_KEY], legacyBackground);

  return {
    name: settings[SITE_NAME_KEY]?.trim() || siteConfig.name,
    author: settings[SITE_AUTHOR_KEY]?.trim() || siteConfig.author,
    description: settings[SITE_DESCRIPTION_KEY]?.trim() || "",
    subtitle: settings[SITE_SUBTITLE_KEY]?.trim() || "",
    logo,
    background: backgrounds[0] ?? "",
    backgrounds,
    backgroundVideo: settings[SITE_BACKGROUND_VIDEO_KEY]?.trim() || "",
    pageBackground: settings[SITE_PAGE_BACKGROUND_KEY]?.trim() || "",
    postBackground: settings[SITE_POST_BACKGROUND_KEY]?.trim() || "",
    // 换 Logo 时页签图标跟着变；只有单独设了页签图标才用它覆盖
    favicon: favicon || logo,
    icp: settings[SITE_ICP_KEY]?.trim() || "",
    icpLink: settings[SITE_ICP_LINK_KEY]?.trim() || "",
  };
}

export function siteToSettings(input: Partial<SiteInfo>): Record<string, string> {
  const entries: Record<string, string> = {};

  if (typeof input.name === "string") {
    entries[SITE_NAME_KEY] = input.name.trim();
  }
  if (typeof input.author === "string") {
    entries[SITE_AUTHOR_KEY] = input.author.trim();
  }
  if (typeof input.description === "string") {
    entries[SITE_DESCRIPTION_KEY] = input.description.trim();
  }
  if (typeof input.subtitle === "string") {
    entries[SITE_SUBTITLE_KEY] = input.subtitle.trim();
  }
  if (typeof input.logo === "string") {
    entries[SITE_LOGO_KEY] = input.logo.trim();
  }
  if (typeof input.background === "string") {
    entries[SITE_BACKGROUND_KEY] = input.background.trim();
  }
  if (Array.isArray(input.backgrounds)) {
    const list = input.backgrounds
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);

    entries[SITE_BACKGROUNDS_KEY] = JSON.stringify(list);
    // 单图字段同步成第一张，保证旧调用点与旧数据读取路径一致
    entries[SITE_BACKGROUND_KEY] = list[0] ?? "";
  }
  if (typeof input.backgroundVideo === "string") {
    entries[SITE_BACKGROUND_VIDEO_KEY] = input.backgroundVideo.trim();
  }
  if (typeof input.pageBackground === "string") {
    entries[SITE_PAGE_BACKGROUND_KEY] = input.pageBackground.trim();
  }
  if (typeof input.postBackground === "string") {
    entries[SITE_POST_BACKGROUND_KEY] = input.postBackground.trim();
  }
  if (typeof input.favicon === "string") {
    entries[SITE_FAVICON_KEY] = input.favicon.trim();
  }
  if (typeof input.icp === "string") {
    entries[SITE_ICP_KEY] = input.icp.trim();
  }
  if (typeof input.icpLink === "string") {
    entries[SITE_ICP_LINK_KEY] = input.icpLink.trim();
  }

  return entries;
}

export function profileToSettings(input: Partial<ProfileSettings>): Record<string, string> {
  const entries: Record<string, string> = {};

  if (typeof input.name === "string") {
    entries[PROFILE_NAME_KEY] = input.name.trim();
  }
  if (typeof input.avatar === "string") {
    entries[PROFILE_AVATAR_KEY] = input.avatar.trim();
  }
  if (typeof input.bio === "string") {
    entries[PROFILE_BIO_KEY] = input.bio.trim();
  }
  if (Array.isArray(input.links)) {
    const links = input.links
      .map((link) => ({
        icon: typeof link?.icon === "string" ? link.icon.trim() : "link",
        label: typeof link?.label === "string" ? link.label.trim() : "",
        url: typeof link?.url === "string" ? link.url.trim() : "",
      }))
      .filter((link) => link.url.length > 0);

    entries[PROFILE_LINKS_KEY] = JSON.stringify(links);

    // 自定义链接已成为唯一数据源，清掉旧版 social.*，避免两处数据互相打架
    for (const key of SOCIAL_KEYS) {
      entries[`${SOCIAL_PREFIX}${key}`] = "";
    }
  }

  return entries;
}
