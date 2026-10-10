import type { Metadata } from "next";

import { VideoManager, type VideoRow } from "@/components/admin/video-manager";
import { catalogs } from "@/lib/messages";
import { listVideosForAdmin } from "@/lib/videos";

export const metadata: Metadata = {
  title: catalogs.zh.adminVideos.title,
};

export default async function AdminVideosPage() {
  const videos = await listVideosForAdmin();

  const items: VideoRow[] = videos.map((video) => ({
    id: video.id,
    title: video.title,
    titleEn: video.titleEn,
    cover: video.cover,
    sourceType: video.sourceType,
    srcUrl: video.srcUrl,
    description: video.description,
    published: video.published,
    pinned: video.pinned,
    sort: video.sort,
  }));

  return <VideoManager items={items} />;
}
