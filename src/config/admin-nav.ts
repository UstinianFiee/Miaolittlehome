import {
  FileTextIcon,
  FolderTreeIcon,
  GalleryHorizontalIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  MusicIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * 后台导航结构。标签只保存文案 key（对应 messages 的 admin.nav.*），
 * 阶段编号用于占位页提示，与 docs/SPEC.md 阶段计划一致。
 */

export type AdminNavItem = {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** 计划实现该模块的阶段；0 表示本阶段已实现 */
  stage: number;
  scopeKey: string;
};

export type AdminNavGroup = {
  labelKey: string;
  items: readonly AdminNavItem[];
};

export const adminNavGroups: readonly AdminNavGroup[] = [
  {
    labelKey: "admin.group.content",
    items: [
      {
        labelKey: "admin.nav.dashboard",
        href: "/admin",
        icon: LayoutDashboardIcon,
        stage: 0,
        scopeKey: "adminDashboard",
      },
      {
        labelKey: "admin.nav.posts",
        href: "/admin/posts",
        icon: FileTextIcon,
        stage: 7,
        scopeKey: "adminPosts",
      },
      {
        labelKey: "admin.nav.videos",
        href: "/admin/videos",
        icon: VideoIcon,
        stage: 13,
        scopeKey: "adminVideos",
      },
      {
        labelKey: "admin.nav.software",
        href: "/admin/software",
        icon: PackageIcon,
        stage: 13,
        scopeKey: "adminSoftware",
      },
      {
        labelKey: "admin.nav.media",
        href: "/admin/media",
        icon: ImagesIcon,
        stage: 9,
        scopeKey: "adminMedia",
      },
      {
        labelKey: "admin.nav.albums",
        href: "/admin/albums",
        icon: GalleryHorizontalIcon,
        stage: 9,
        scopeKey: "adminAlbums",
      },
      {
        labelKey: "admin.nav.announcements",
        href: "/admin/announcements",
        icon: MegaphoneIcon,
        stage: 14,
        scopeKey: "adminAnnouncements",
      },
    ],
  },
  {
    labelKey: "admin.group.taxonomy",
    items: [
      {
        labelKey: "admin.nav.categories",
        href: "/admin/categories",
        icon: FolderTreeIcon,
        stage: 7,
        scopeKey: "adminCategories",
      },
      {
        labelKey: "admin.nav.tags",
        href: "/admin/tags",
        icon: TagsIcon,
        stage: 7,
        scopeKey: "adminTags",
      },
    ],
  },
  {
    labelKey: "admin.group.interaction",
    items: [
      {
        labelKey: "admin.nav.comments",
        href: "/admin/comments",
        icon: MessageSquareIcon,
        stage: 10,
        scopeKey: "adminComments",
      },
      {
        labelKey: "admin.nav.friends",
        href: "/admin/friends",
        icon: UsersIcon,
        stage: 14,
        scopeKey: "adminFriends",
      },
    ],
  },
  {
    labelKey: "admin.group.system",
    items: [
      {
        labelKey: "admin.nav.settings",
        href: "/admin/settings",
        icon: SettingsIcon,
        stage: 15,
        scopeKey: "adminSettings",
      },
      {
        labelKey: "admin.nav.playlist",
        href: "/admin/playlist",
        icon: MusicIcon,
        stage: 15,
        scopeKey: "adminPlaylist",
      },
      {
        labelKey: "admin.nav.logs",
        href: "/admin/logs",
        icon: ScrollTextIcon,
        stage: 15,
        scopeKey: "adminLogs",
      },
    ],
  },
] as const;

/** 展平后的导航项，便于按 href 查找。 */
export const adminNavItems: readonly AdminNavItem[] = adminNavGroups.flatMap(
  (group) => group.items
);
