import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  discardUpload,
  mergeChunks,
  planChunks,
  prepareUpload,
  writeChunk,
  ChunkError,
  type ChunkPlan,
} from "@/lib/chunked-upload";

/**
 * 软件安装包存储（docs/SPEC.md 技术约束：软件包 ≤ 2G，存 SOFTWARE_DIR）。
 * 与媒体库共用分片内核，但目录、大小上限与扩展名白名单不同。
 */

export const SOFTWARE_DIR = path.resolve(process.env.SOFTWARE_DIR ?? "./software");

export const PACKAGE_CHUNK_SIZE = 8 * 1024 * 1024;
export const PACKAGE_DIRECT_LIMIT = 10 * 1024 * 1024;
export const PACKAGE_MAX_SIZE = 2 * 1024 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".gz",
  ".tgz",
  ".exe",
  ".msi",
  ".dmg",
  ".pkg",
  ".apk",
  ".deb",
  ".rpm",
  ".appimage",
];

export class PackageError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PackageError";
    this.status = status;
  }
}

export function assertPackageSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new PackageError("文件大小无效", 400);
  }
  if (size > PACKAGE_MAX_SIZE) {
    throw new PackageError(
      `安装包超过大小上限（${Math.round(PACKAGE_MAX_SIZE / 1024 / 1024 / 1024)}GB）`,
      413
    );
  }
}

export function assertPackageExtension(fileName: string): void {
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new PackageError(`不支持的安装包格式：${ext || "未知"}`, 400);
  }
}

/** 服务端生成文件名（不信任客户端），按 年/月 分目录。 */
export function buildPackageRelative(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  return `${dir}/${name}`;
}

export function toPackagePublicPath(relative: string): string {
  return `/software-files/${relative.replaceAll("\\", "/")}`;
}

export function relativeFromPackagePublicPath(publicPath: string): string {
  return publicPath.replace(/^\/software-files\//, "");
}

/** 解析为安全绝对路径，拒绝目录穿越与隐藏目录。 */
export function resolvePackagePath(relative: string): string {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.split("/").some((segment) => segment.startsWith("."))) {
    throw new PackageError("非法的安装包路径", 400);
  }

  const absolute = path.resolve(SOFTWARE_DIR, normalized);
  if (!absolute.startsWith(SOFTWARE_DIR + path.sep)) {
    throw new PackageError("非法的安装包路径", 400);
  }

  return absolute;
}

export function planPackageChunks(size: number) {
  return planChunks(size, PACKAGE_DIRECT_LIMIT, PACKAGE_CHUNK_SIZE);
}

export function preparePackageUpload(size: number): Promise<ChunkPlan> {
  assertPackageSize(size);
  return prepareUpload(SOFTWARE_DIR, size, {
    directLimit: PACKAGE_DIRECT_LIMIT,
    chunkSize: PACKAGE_CHUNK_SIZE,
  });
}

export function writePackageChunk(uploadId: string, index: number, data: Buffer): Promise<void> {
  return writeChunk(SOFTWARE_DIR, uploadId, index, data, PACKAGE_CHUNK_SIZE);
}

export function discardPackageUpload(uploadId: string): Promise<void> {
  return discardUpload(SOFTWARE_DIR, uploadId);
}

export type CompletedPackage = { relative: string; absolute: string; size: number };

/** 合并分片落盘；返回相对路径与最终大小。 */
export async function completePackageUpload(params: {
  uploadId: string;
  fileName: string;
  size: number;
  totalChunks: number;
}): Promise<CompletedPackage> {
  assertPackageSize(params.size);
  assertPackageExtension(params.fileName);

  const relative = buildPackageRelative(params.fileName);
  const absolute = path.join(SOFTWARE_DIR, relative);

  let written: number;
  try {
    written = await mergeChunks(SOFTWARE_DIR, params.uploadId, params.totalChunks, absolute);
  } catch (error) {
    if (error instanceof ChunkError) {
      throw new PackageError(error.message, error.status);
    }
    throw error;
  }

  try {
    await discardPackageUpload(params.uploadId);
  } catch (error) {
    console.error("[software] 清理临时分片失败：", params.uploadId, error);
  }

  if (written !== params.size) {
    await fs.rm(absolute, { force: true });
    throw new PackageError(
      `上传内容不完整（期望 ${params.size} 字节，实际 ${written} 字节）`,
      400
    );
  }

  return { relative, absolute, size: written };
}

/** 删除安装包文件；失败只记录日志，不影响记录删除。 */
export async function removePackageFile(publicPath: string): Promise<void> {
  try {
    const absolute = resolvePackagePath(relativeFromPackagePublicPath(publicPath));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await fs.rm(absolute, { force: true });
        return;
      } catch (error) {
        if (attempt === 4) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
      }
    }
  } catch (error) {
    console.error("[software] 删除安装包失败：", publicPath, error);
  }
}
