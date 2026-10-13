import path from "node:path";

import { NextResponse } from "next/server";

import { BACKUP_DIR, BACKUP_MAX_SIZE, BackupError, sweepStaging } from "@/lib/backup";
import { prepareUpload } from "@/lib/chunked-upload";
import { errorResponse, requireString } from "@/lib/validation";

/**
 * 开始上传备份包。
 *
 * 复用媒体库那套分片内核（init → chunk → complete）：
 * 备份包可能几百 MB，一次性 POST 传失败就得从头再来。
 */

const DIRECT_LIMIT = 10 * 1024 * 1024;
const CHUNK_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileName = requireString(body.fileName, "文件名", { max: 255 });
    const size = Number(body.size);

    if (path.extname(fileName).toLowerCase() !== ".zip") {
      throw new BackupError("只支持导入 .zip 备份包");
    }
    if (!Number.isFinite(size) || size <= 0) {
      throw new BackupError("文件大小无效");
    }
    if (size > BACKUP_MAX_SIZE) {
      throw new BackupError("备份包超过 4GB 上限", 413);
    }

    // 顺手清掉过期的暂存文件（按小时节流）
    await sweepStaging();

    const plan = await prepareUpload(BACKUP_DIR, size, {
      directLimit: DIRECT_LIMIT,
      chunkSize: CHUNK_SIZE,
    });

    return NextResponse.json({ ok: true, data: plan });
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
