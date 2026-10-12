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

/**
 * 临时分片目录超过这个时长仍未完成，就视为废弃。
 * 单个文件上限 100MB，留一天足够覆盖「传了一半去吃饭」这类情况。
 */
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;
/** 清理节流：最多每小时扫一次临时目录，避免每次 init 都去 stat 一堆目录。 */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweepAt = 0;

/**
 * 清理废弃的分片上传目录。
 *
 * 上传是**无状态**的：服务端不记录上传会话，分片直接落在 `<baseDir>/.tmp/<uploadId>`。
 * 正常流程会在 complete（或失败分支）里删掉；但**客户端中途关页面 / 断网**时
 * complete 永远不会到达，那些分片就会一直留在磁盘上慢慢堆积。
 * 这里在每次开始新上传时顺手扫一遍，删掉超过 STALE_UPLOAD_MS 没动静的目录。
 *
 * @returns 删掉的目录数量
 */
export async function sweepStaleUploads(baseDir: string, force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastSweepAt < SWEEP_INTERVAL_MS) {
    return 0;
  }
  lastSweepAt = now;

  let entries: string[];
  try {
    entries = await fs.readdir(tempRoot(baseDir));
  } catch {
    // 目录还不存在，没什么可清的
    return 0;
  }

  let removed = 0;
  for (const name of entries) {
    const dir = path.join(tempRoot(baseDir), name);
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory() || now - stat.mtimeMs < STALE_UPLOAD_MS) {
        continue;
      }
      await fs.rm(dir, { recursive: true, force: true });
      removed += 1;
    } catch {
      // 单个目录清理失败不影响其它，也不影响本次上传
    }
  }

  if (removed > 0) {
    console.log(`[upload] 清理了 ${removed} 个废弃的分片目录（${baseDir}）`);
  }
  return removed;
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

  // 顺手清掉废弃的临时分片（按小时节流，失败不影响本次上传）
  await sweepStaleUploads(baseDir).catch(() => 0);

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
