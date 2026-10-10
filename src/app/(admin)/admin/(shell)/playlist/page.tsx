import type { Metadata } from "next";

import { PlaylistManager, type AudioMediaOption } from "@/components/admin/playlist-manager";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";
import { getPlaylist } from "@/lib/playlist";

export const metadata: Metadata = {
  title: catalogs.zh.playlistAdmin.settingsTitle,
};

/** 音乐播放器设置：曲目列表在全站播放器中循环播放。 */
export default async function AdminPlaylistPage() {
  const [tracks, audio] = await Promise.all([
    getPlaylist(),
    listMedia({ type: "audio", limit: 100 }),
  ]);

  const audioMedia: AudioMediaOption[] = audio.map((item) => ({
    id: item.id,
    path: item.path,
    title: item.title ?? item.path,
  }));

  return (
    <PlaylistManager
      initialTracks={tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        src: track.src,
        cover: track.cover ?? "",
      }))}
      audioMedia={audioMedia}
    />
  );
}
