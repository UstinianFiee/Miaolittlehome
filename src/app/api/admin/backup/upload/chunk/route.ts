import { NextResponse } from "next/server";

import { BACKUP_DIR, BackupError } from "@/lib/backup";
import { writeChunk } from "@/lib/chunked-upload";
import { assertBodyWithinLimit, PayloadTooLargeError } from "@/lib/validation";

/** 接收单个分片：原始二进制 body + x-upload-id / x-chunk-index 头。 */

/** 与 upload/init 路由里的 DIRECT_LIMIT / CHUNK_SIZE 保持一致（那边未导出，这里镜像一份）。 */
const DIRECT_LIMIT = 10 * 1024 * 1024;
const CHUNK_SIZE = 8 * 1024 * 1024;
/**
 * 单块允许的最大字节。
 *
 * ≤10MB 的备份包走单块直传（planChunks 返回 chunkSize = 文件大小、totalChunks = 1），
 * 若只按 8MB 判会把 8–10MB 的包误拒成「分片超过大小上限」。
 */
const MAX_CHUNK_BYTES = Math.max(CHUNK_SIZE, DIRECT_LIMIT);
/** 单片请求体上限：8MB 分片，或 ≤10MB 的整包直传，再留一点余量。 */
const MAX_CHUNK_BODY_BYTES = 10 * 1024 * 1024 + 64 * 1024;

export async function POST(request: Request) {
  try {
    assertBodyWithinLimit(request, MAX_CHUNK_BODY_BYTES);

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
    await writeChunk(BACKUP_DIR, uploadId, index, buffer, MAX_CHUNK_BYTES);

    return NextResponse.json({ ok: true, data: { index, received: buffer.byteLength } });
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 413 });
    }
    console.error("[backup] 分片写入失败：", error);
    return NextResponse.json({ ok: false, error: "分片上传失败" }, { status: 500 });
  }
}
