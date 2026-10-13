import { NextResponse } from "next/server";

import { BACKUP_DIR, BackupError } from "@/lib/backup";
import { writeChunk } from "@/lib/chunked-upload";

/** 接收单个分片：原始二进制 body + x-upload-id / x-chunk-index 头。 */

const CHUNK_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const uploadId = request.headers.get("x-upload-id");
    const indexHeader = request.headers.get("x-chunk-index");

    if (!uploadId) {
      throw new BackupError("缺少上传标识");
    }
    const index = Number(indexHeader);
    if (!Number.isInteger(index) || index < 0) {
      throw new BackupError("缺少或非法的分片序号");
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    await writeChunk(BACKUP_DIR, uploadId, index, buffer, CHUNK_SIZE);

    return NextResponse.json({ ok: true, data: { index, received: buffer.byteLength } });
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[backup] 分片写入失败：", error);
    return NextResponse.json({ ok: false, error: "分片上传失败" }, { status: 500 });
  }
}
