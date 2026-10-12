/**
 * 站点级配置：站点信息与前台导航结构。
 *
 * 导航标签只保存文案 key（对应 messages/*.json），不硬编码文案；
 * 阶段 3 引入 next-intl 后无需改动本文件。
 */

export type NavItem = {
  /** messages 中的文案 key，例如 "nav.home" */
  labelKey: string;
  href: string;
};

export const siteConfig = {
  name: "渺の小家",
  author: "Shifenmiao",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const navItems: readonly NavItem[] = [
  { labelKey: "nav.home", href: "/" },
  { labelKey: "nav.posts", href: "/posts" },
  { labelKey: "nav.shuoshuo", href: "/shuoshuo" },
  { labelKey: "nav.archive", href: "/archive" },
  { labelKey: "nav.categories", href: "/categories" },
  { labelKey: "nav.tags", href: "/tags" },
  { labelKey: "nav.albums", href: "/albums" },
  { labelKey: "nav.videos", href: "/videos" },
  { labelKey: "nav.software", href: "/software" },
  { labelKey: "nav.wall", href: "/wall" },
  { labelKey: "nav.about", href: "/about" },
] as const;

/** 前台的后台登录入口（鉴权在阶段 5、后台页面在阶段 6）。 */
export const adminEntry: NavItem = { labelKey: "actions.adminLogin", href: "/admin" };
