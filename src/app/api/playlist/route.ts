import { NextResponse } from "next/server";

import { getPlaylist } from "@/lib/playlist";

/** 公开接口：读取播放列表（前台播放器使用）。 */
export async function GET() {
  const tracks = await getPlaylist();
  return NextResponse.json({ ok: true, data: { tracks } });
}
