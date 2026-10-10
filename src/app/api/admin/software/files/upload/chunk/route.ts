import { NextResponse } from "next/server";

import { PackageError, writePackageChunk } from "@/lib/software-storage";

/** 接收安装包分片：原始二进制 body + x-upload-id / x-chunk-index 头。 */
export async function POST(request: Request) {
  try {
    const uploadId = request.headers.get("x-upload-id");
    const index = Number(request.headers.get("x-chunk-index"));

    if (!uploadId) {
      throw new PackageError("缺少上传标识", 400);
    }
    if (!Number.isInteger(index) || index < 0) {
      throw new PackageError("缺少或非法的分片序号", 400);
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    await writePackageChunk(uploadId, index, buffer);

    return NextResponse.json({ ok: true, data: { index, received: buffer.byteLength } });
  } catch (error) {
    if (error instanceof PackageError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[software] 分片写入失败：", error);
    return NextResponse.json({ ok: false, error: "分片上传失败" }, { status: 500 });
  }
}
