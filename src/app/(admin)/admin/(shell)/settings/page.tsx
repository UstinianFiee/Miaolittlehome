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
      <SiteSettingsManager initial={site} images={imageOptions} videos={videoOptions} />

      <ProfileManager initial={profile} images={imageOptions} />
    </div>
  );
}
