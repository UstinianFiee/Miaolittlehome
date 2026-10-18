import type { Metadata } from "next";

import type { MediaOption } from "@/components/admin/media-field";
import { ProfileManager } from "@/components/admin/profile-manager";
import { SiteSettingsManager } from "@/components/admin/site-settings-manager";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";
import { getProfile, getSiteInfo } from "@/lib/settings";

export const metadata: Metadata = {
  title: catalogs.zh.admin.nav.settings,
};

/**
 * 站点设置中心：站点信息 + 个人资料。
 * 音乐播放器在「音乐播放器」页（/admin/playlist），日志在「日志」页（/admin/logs）。
 */
export default async function AdminSettingsPage() {
  const [site, profile, images, videos] = await Promise.all([
    getSiteInfo(),
    getProfile(),
    listMedia({ type: "image", limit: 200 }),
    listMedia({ type: "video", limit: 100 }),
  ]);

  const imageOptions: MediaOption[] = images.map((item) => ({
    id: item.id,
    path: item.path,
    title: item.title ?? item.path,
  }));
  const videoOptions: MediaOption[] = videos.map((item) => ({
    id: item.id,
    path: item.path,
    title: item.title ?? item.path,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {catalogs.zh.admin.nav.settings}
        </h1>
        <p className="text-sm text-muted-foreground">{catalogs.zh.adminSite.pageHint}</p>
      </div>

      {/* 长表单锚点导航：不用来回滚动找「个人资料」 */}
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card p-1.5 text-sm">
        <a
          href="#site-settings"
          className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {catalogs.zh.adminSite.title}
        </a>
        <a
          href="#profile-settings"
          className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {catalogs.zh.adminProfile.title}
        </a>
      </nav>

      <div id="site-settings" className="scroll-mt-28">
        <SiteSettingsManager initial={site} images={imageOptions} videos={videoOptions} />
      </div>

      <div id="profile-settings" className="scroll-mt-28">
        <ProfileManager initial={profile} images={imageOptions} />
      </div>
    </div>
  );
}
