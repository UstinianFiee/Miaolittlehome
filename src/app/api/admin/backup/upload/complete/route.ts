import fsp from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  applyBackupData,
  BACKUP_DIR,
  BACKUP_MAX_SIZE,
  BackupError,
  parseBackupFile,
  resolveBackupTarget,
  sweepStaging,
  writeSafetySnapshot,
} from "@/lib/backup";
import { ChunkError, discardUpload, isValidUploadId, mergeChunks } from "@/lib/chunked-upload";
import { logOperation } from "@/lib/logs";
import { revalidateAll } from "@/lib/revalidate";
import { errorResponse, requireString } from "@/lib/validation";
import { extractZipEntry, readZipEntries, readZipEntryBuffer, ZipError } from "@/lib/zip";

/**
 * 合并分片 → 解析备份包 → 还原。
 *
 * ## 顺序是有讲究的
 *
 * 1. **先存快照**：把当前数据导出一份到 BACKUP_DIR。导入是覆盖式的，
 *    万一选错了包，还有回头路。
 * 2. **再还原文件**：这一步失败的话数据库还没动过，属于最安全的中断点。
 * 3. **最后写库**：数据库是「提交点」，在一个事务里完成，要么全成要么全回滚。
 *
 * 无论成功失败，临时分片和暂存的 zip 都会在 finally 里清掉。
 */

export async function POST(request: Request) {
  let uploadId: string | null = null;
  let staged: string | null = null;
  const warnings: string[] = [];

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // uploadId 会拼进文件路径、也会用于 finally 里的删除，必须先按分片内核
    // 的同一套规则校验，否则 `../xxx` 能删到 BACKUP_DIR 之外的 .zip（包括导入前快照）。
    const rawUploadId = requireString(body.uploadId, "上传标识", { max: 64 });
    if (!isValidUploadId(rawUploadId)) {
      throw new BackupError("非法的上传标识");
    }
    uploadId = rawUploadId;

    const fileName = requireString(body.fileName, "文件名", { max: 255 });
    const size = Number(body.size);
    const totalChunks = Number(body.totalChunks);

    if (path.extname(fileName).toLowerCase() !== ".zip") {
      throw new BackupError("只支持导入 .zip 备份包");
    }
    if (!Number.isFinite(size) || size <= 0) {
      throw new BackupError("文件大小无效");
    }
    if (size > BACKUP_MAX_SIZE) {
      throw new BackupError("备份包超过 4GB 上限", 413);
    }
    if (!Number.isInteger(totalChunks) || totalChunks < 1) {
      throw new BackupError("分片数量无效");
    }

    await fsp.mkdir(path.join(BACKUP_DIR, ".stage"), { recursive: true });
    staged = path.join(BACKUP_DIR, ".stage", `${uploadId}.zip`);

    let written: number;
    try {
      written = await mergeChunks(BACKUP_DIR, uploadId, totalChunks, staged);
    } catch (error) {
      if (error instanceof ChunkError) {
        throw new BackupError(error.message, error.status);
      }
      throw error;
    }
    if (written !== size) {
      throw new BackupError(`上传内容不完整（期望 ${size} 字节，实际 ${written} 字节）`);
    }

    const entries = await readZipEntries(staged);
    const manifest = entries.find((entry) => entry.name === "backup.json");
    if (!manifest) {
      throw new BackupError("备份包里没有 backup.json，可能不是本站导出的包");
    }

    const parsed = parseBackupFile(await readZipEntryBuffer(staged, manifest));

    // 1) 导入前自动快照
    const snapshot = await writeSafetySnapshot();

    // 2) 还原文件（媒体 / 安装包）
    let filesWritten = 0;
    for (const entry of entries) {
      const resolved = resolveBackupTarget(entry.name);
      if (resolved.warning) {
        warnings.push(resolved.warning);
      }
      if (!resolved.target) {
        continue;
      }
      await extractZipEntry(staged, entry, resolved.target);
      filesWritten += 1;
    }

    // 3) 写库（事务内整体替换）
    const counts = await applyBackupData(parsed.data);

    revalidateAll();
    await logOperation({
      action: "backup_import",
      target: parsed.siteName || fileName,
      detail:
        `来源导出时间 ${parsed.exportedAt || "未知"} · 文章 ${counts.posts} · ` +
        `说说 ${counts.shuoshuo} · 评论 ${counts.comments} · 文件 ${filesWritten}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        counts,
        files: { written: filesWritten, skipped: warnings.length },
        snapshot,
        source: { siteName: parsed.siteName, exportedAt: parsed.exportedAt },
        warnings,
      },
    });
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    // 包本身损坏（不是 zip、CRC 不符、ZIP64…）属于用户可修正的问题，给 400 而不是 500
    if (error instanceof ZipError) {
      return NextResponse.json(
        { ok: false, error: `备份包无法解析：${error.message}` },
        { status: 400 }
      );
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  } finally {
    if (uploadId) {
      await discardUpload(BACKUP_DIR, uploadId).catch(() => undefined);
    }
    if (staged) {
      await fsp.rm(staged, { force: true }).catch(() => undefined);
    }
    void sweepStaging().catch(() => undefined);
  }
}
