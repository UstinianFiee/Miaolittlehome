import { NextResponse } from "next/server";

import { saveVideoThumbnail } from "@/lib/media";
import { revalidateAlbums } from "@/lib/revalidate";

/**
 * 接收浏览器抽好的视频封面帧（二进制），压成 640 宽的 webp 落盘并挂到媒体记录上。
 *
 * 为什么由浏览器抽帧：服务端没装 ffmpeg，生成不了视频缩略图；而浏览器在上传时
 * 手里就有这个文件，用 canvas 抽一帧几乎不花时间。抽好后媒体库只加载这张小图，
 * 不再需要 `<video>` 去现读视频数据（那正是「媒体库卡死」的根因）。
 *
 * 鉴权由 middleware 统一处理（`/api/admin/:path*` 已在 matcher 里）。
 */
const MAX_THUMB_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mediaId = Number(id);

  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    return NextResponse.json({ ok: false, error: "无效的媒体 ID" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await request.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, error: "无法读取封面数据" }, { status: 400 });
  }

  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, error: "封面数据为空" }, { status: 400 });
  }
  if (buffer.length > MAX_THUMB_BYTES) {
    return NextResponse.json({ ok: false, error: "封面数据过大" }, { status: 413 });
  }

  const thumb = await saveVideoThumbnail(mediaId, buffer);
  if (!thumb) {
    return NextResponse.json({ ok: false, error: "媒体不存在或不是视频" }, { status: 404 });
  }

  // 相册等前台页面可能展示这张封面，清一下缓存
  revalidateAlbums();

  return NextResponse.json({ ok: true, data: { thumb } });
}
