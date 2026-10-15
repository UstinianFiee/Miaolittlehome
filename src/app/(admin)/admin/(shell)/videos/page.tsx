import type { Metadata } from "next";

import { VideoManager, type VideoRow } from "@/components/admin/video-manager";
import type { MediaOption } from "@/components/admin/media-field";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";
import { listVideosForAdmin } from "@/lib/videos";

export const metadata: Metadata = {
  title: catalogs.zh.adminVideos.title,
};

export default async function AdminVideosPage() {
  const [videos, images, videoMedia] = await Promise.all([
    listVideosForAdmin(),
    listMedia({ type: "image", limit: 200 }),
    listMedia({ type: "video", limit: 200 }),
  ]);

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

  const imageOptions: MediaOption[] = images.map((image) => ({
    id: image.id,
    path: image.path,
    title: image.title ?? image.path,
  }));
  const videoOptions: MediaOption[] = videoMedia.map((item) => ({
    id: item.id,
    path: item.path,
    title: item.title ?? item.path,
  }));

  return <VideoManager items={items} images={imageOptions} videos={videoOptions} />;
}
