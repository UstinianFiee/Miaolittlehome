import type { Metadata } from "next";

import { BackupManager, type BackupStatsView } from "@/components/admin/backup-manager";
import { backupStats } from "@/lib/backup";
import { catalogs } from "@/lib/messages";

export const metadata: Metadata = {
  title: catalogs.zh.admin.nav.backup,
};

/**
 * 内容导出 / 导入。
 *
 * 和 `scripts/backup.sh` 分工不同：那个是整目录级的运维备份（含数据库文件本身），
 * 这里是内容级的搬运，用来把一台服务器上的东西搬到另一台。
 */
export default async function AdminBackupPage() {
  const stats = await backupStats();

  const view: BackupStatsView = {
    counts: {
      posts: stats.counts.posts,
      shuoshuo: stats.counts.shuoshuo,
      comments: stats.counts.comments,
      categories: stats.counts.categories,
      tags: stats.counts.tags,
      albums: stats.counts.albums,
      media: stats.counts.media,
      videos: stats.counts.videos,
      software: stats.counts.software,
      announcements: stats.counts.announcements,
      friends: stats.counts.friends,
    },
    media: stats.media,
    software: stats.software,
  };

  return <BackupManager stats={view} />;
}
