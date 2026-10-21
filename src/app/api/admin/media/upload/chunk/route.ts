import { NextResponse } from "next/server";

import { MediaError, writeMediaChunk } from "@/lib/media";
import { assertBodyWithinLimit, PayloadTooLargeError } from "@/lib/validation";

/**
 * 单片请求体上限。
 *
 * 正常分片是 8MB；但「≤10MB 的文件走直传」时会只有一块、大小就是文件大小，
 * 所以按 10MB + 余量取上限，保证合法请求不被误杀，同时不让超大 body 先进内存。
 */
const MAX_CHUNK_BODY_BYTES = 10 * 1024 * 1024 + 64 * 1024;

/** 接收单个分片：原始二进制 body + x-upload-id / x-chunk-index 头。 */
export async function POST(request: Request) {
  try {
    assertBodyWithinLimit(request, MAX_CHUNK_BODY_BYTES);

    const uploadId = request.headers.get("x-upload-id");
    const indexHeader = request.headers.get("x-chunk-index");

    if (!uploadId) {
      throw new MediaError("缺少上传标识", 400);
    }
    const index = Number(indexHeader);
    if (!Number.isInteger(index) || index < 0) {
      throw new MediaError("缺少或非法的分片序号", 400);
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    await writeMediaChunk(uploadId, index, buffer);

    return NextResponse.json({ ok: true, data: { index, received: buffer.byteLength } });
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 413 });
    }
    console.error("[media] 分片写入失败：", error);
    return NextResponse.json({ ok: false, error: "分片上传失败" }, { status: 500 });
  }
}
