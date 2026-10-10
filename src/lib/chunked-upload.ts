import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * 分片上传内核（媒体库与软件安装包共用）。
 *
 * 统一流程：init → chunk(可多片) → complete。
 * - 单文件不超过 directLimit 时只有 1 片（等价直传）
 * - 超过则按 chunkSize 分片，服务端写入 <baseDir>/.tmp/<uploadId> 后按序合并
 * - 不做断点续传（docs/SPEC.md 明确本期不做）
 */

export type ChunkPlan = { uploadId: string; chunkSize: number; totalChunks: number };

export class ChunkError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ChunkError";
    this.status = status;
  }
}

export function planChunks(size: number, directLimit: number, chunkSize: number): { chunkSize: number; totalChunks: number } {
  const effective = size > directLimit ? chunkSize : size;
  return { chunkSize: effective, totalChunks: Math.max(1, Math.ceil(size / effective)) };
}

function tempRoot(baseDir: string): string {
  return path.join(baseDir, ".tmp");
}

export function tempDirFor(baseDir: string, uploadId: string): string {
  if (!/^[a-z0-9-]{8,64}$/i.test(uploadId)) {
    throw new ChunkError("非法的上传标识", 400);
  }
  return path.join(tempRoot(baseDir), uploadId);
}

export async function prepareUpload(
  baseDir: string,
  size: number,
  options: { directLimit: number; chunkSize: number }
): Promise<ChunkPlan> {
  const uploadId = crypto.randomUUID();
  await fs.mkdir(tempDirFor(baseDir, uploadId), { recursive: true });

  return { uploadId, ...planChunks(size, options.directLimit, options.chunkSize) };
}

export async function writeChunk(
  baseDir: string,
  uploadId: string,
  index: number,
  data: Buffer,
  maxChunkSize: number
): Promise<void> {
  if (!Number.isInteger(index) || index < 0) {
    throw new ChunkError("非法的分片序号", 400);
  }
  if (data.byteLength === 0) {
    throw new ChunkError("分片内容为空", 400);
  }
  if (data.byteLength > maxChunkSize) {
    throw new ChunkError("分片超过大小上限", 413);
  }

  const dir = tempDirFor(baseDir, uploadId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${index}.part`), data);
}

export async function discardUpload(baseDir: string, uploadId: string): Promise<void> {
  await fs.rm(tempDirFor(baseDir, uploadId), { recursive: true, force: true });
}

/** 按序合并分片到 target，返回实际写入字节数。失败时清理半截文件。 */
export async function mergeChunks(
  baseDir: string,
  uploadId: string,
  totalChunks: number,
  target: string
): Promise<number> {
  const dir = tempDirFor(baseDir, uploadId);
  await fs.mkdir(path.dirname(target), { recursive: true });

  const handle = await fs.open(target, "w");
  let written = 0;

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      let chunk: Buffer;
      try {
        chunk = await fs.readFile(path.join(dir, `${index}.part`));
      } catch {
        throw new ChunkError(`缺少分片 ${index}，上传未完成`, 400);
      }
      await handle.write(chunk);
      written += chunk.byteLength;
    }
  } catch (error) {
    // 合并失败时删掉写了一半的目标文件，避免留下孤儿
    await handle.close();
    await fs.rm(target, { force: true }).catch(() => undefined);
    throw error;
  }

  await handle.close();
  return written;
}
