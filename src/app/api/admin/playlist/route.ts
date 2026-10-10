import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { PlaylistError, savePlaylist, validatePlaylist } from "@/lib/playlist";
import { revalidatePlaylist } from "@/lib/revalidate";
import { errorResponse } from "@/lib/validation";

/** 后台保存播放列表。 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { tracks?: unknown };
    const tracks = validatePlaylist(body.tracks ?? []);

    await savePlaylist(tracks);
    revalidatePlaylist();
    await logOperation({ action: "playlist_update", detail: `${tracks.length} 首` });

    return NextResponse.json({ ok: true, data: { tracks } });
  } catch (error) {
    if (error instanceof PlaylistError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
