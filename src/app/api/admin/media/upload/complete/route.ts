import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { completeUpload, discardMediaUpload, MediaError } from "@/lib/media";
import { revalidateAlbums } from "@/lib/revalidate";
import { errorResponse, optionalInt, optionalString, requireString } from "@/lib/validation";

/** 合并分片并入库。 */
export async function POST(request: Request) {
  let uploadId: string | null = null;
  let albumId: number | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    uploadId = requireString(body.uploadId, "上传标识", { max: 64 });
    albumId = optionalInt(body.albumId, "相册");

    const created = await completeUpload({
      uploadId,
      fileName: requireString(body.fileName, "文件名", { max: 255 }),
      size: Number(body.size),
      totalChunks: Number(body.totalChunks),
      title: optionalString(body.title, "标题", 200),
      albumId,
    });

    await logOperation({ action: "media_upload", target: created.path, detail: created.title });
    revalidateAlbums([albumId]);

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    // 失败时清理临时分片，避免残留
    if (uploadId) {
      await discardMediaUpload(uploadId).catch(() => undefined);
    }

    if (error instanceof MediaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
