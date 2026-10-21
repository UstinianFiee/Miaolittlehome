import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  ChunkError,
  discardUpload,
  mergeChunks,
  planChunks,
  prepareUpload,
  writeChunk,
  type ChunkPlan,
} from "@/lib/chunked-upload";
import { ALLOWED_EXTENSIONS, type MediaKind } from "@/lib/media-extensions";
import { prisma } from "@/lib/prisma";

/**
 * 媒体存储层（docs/SPEC.md 技术约束 6 与 8）。
 *
 * 上传流程统一为「init → chunk(可多片) → complete」：
 * - 单文件 ≤ 10MB 只有 1 片（等价于直传）
 * - > 10MB 按 8MB 分片，服务端写入临时目录后按序合并
 * - 不做断点续传（SPEC 明确本期不做）
 *
 * 文件名由服务端生成（不信任客户端文件名），按 年/月 分目录存放。
 */

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR ?? "./uploads");

// libvips 默认会缓存打开的文件句柄，导致 Windows 上刚处理过的图片无法删除
// （unlink 报 EPERM）。关闭文件缓存即可，代价可忽略。
sharp.cache({ files: 0 });

export const CHUNK_SIZE = 8 * 1024 * 1024;
export const DIRECT_UPLOAD_LIMIT = 10 * 1024 * 1024;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export type { MediaKind } from "@/lib/media-extensions";

// 扩展名白名单放在 media-extensions.ts（纯数据，客户端组件也要用），
// 这里转出去，老的 `import { ALLOWED_EXTENSIONS } from "@/lib/media"` 仍然有效。
export { ALLOWED_EXTENSIONS, MEDIA_KINDS, MEDIA_ACCEPT } from "@/lib/media-extensions";

export class MediaError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MediaError";
    this.status = status;
  }
}

/** 解析出安全的绝对路径；越界（目录穿越）或隐藏目录一律拒绝。 */
export function resolveMediaPath(relative: string): string {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.split("/").some((segment) => segment.startsWith("."))) {
    throw new MediaError("非法的媒体路径", 400);
  }

  const absolute = path.resolve(MEDIA_DIR, normalized);
  if (!absolute.startsWith(MEDIA_DIR + path.sep)) {
    throw new MediaError("非法的媒体路径", 400);
  }

  return absolute;
}

/** 媒体记录里的 path 形如 /media/2026/10/xxx.jpg */
export function toPublicPath(relative: string): string {
  return `/media/${relative.replaceAll("\\", "/")}`;
}

export function relativeFromPublicPath(publicPath: string): string {
  return publicPath.replace(/^\/media\//, "");
}

export function detectKind(fileName: string, declared?: string | null): MediaKind {
  const ext = path.extname(fileName).toLowerCase();

  for (const kind of Object.keys(ALLOWED_EXTENSIONS) as MediaKind[]) {
    if (ALLOWED_EXTENSIONS[kind].includes(ext)) {
      return kind;
    }
  }

  throw new MediaError(`不支持的文件类型：${ext || "未知"}`, 400);
}

export function assertSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new MediaError("文件大小无效", 400);
  }
  if (size > MAX_FILE_SIZE) {
    throw new MediaError(
      `文件超过大小上限（${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB）`,
      413
    );
  }
}

/** 服务端生成存储路径：年/月/时间戳-随机.扩展名（不信任客户端文件名）。 */
function buildStorageRelative(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  return `${dir}/${name}`;
}

/** 供路由复用的分片能力（媒体目录）。 */
export function planMediaChunks(size: number) {
  return planChunks(size, DIRECT_UPLOAD_LIMIT, CHUNK_SIZE);
}

export function prepareMediaUpload(size: number): Promise<ChunkPlan> {
  return prepareUpload(MEDIA_DIR, size, {
    directLimit: DIRECT_UPLOAD_LIMIT,
    chunkSize: CHUNK_SIZE,
  });
}

/**
 * 单块允许的最大字节。
 *
 * 分片正常是 `CHUNK_SIZE`（8MB）；但「≤ `DIRECT_UPLOAD_LIMIT`（10MB）的文件走直传」
 * 时只有一块、大小就是文件大小 —— 只按 8MB 判会把 8–10MB 的文件全部误拒成 413。
 * 所以取两者较大值，与 `planChunks()` 的返回值保持一致。
 */
const MAX_CHUNK_BYTES = Math.max(CHUNK_SIZE, DIRECT_UPLOAD_LIMIT);

export function writeMediaChunk(uploadId: string, index: number, data: Buffer): Promise<void> {
  return writeChunk(MEDIA_DIR, uploadId, index, data, MAX_CHUNK_BYTES);
}

export function discardMediaUpload(uploadId: string): Promise<void> {
  return discardUpload(MEDIA_DIR, uploadId);
}

// ---------- 合并与入库 ----------

/** 超过这个体积的图片不生成缩略图（避免把大文件整个读进内存）。 */
const THUMBNAIL_MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/** 图片最长边上限：超过则等比缩小（2560 足够 2K 屏与正文放大查看）。 */
const IMAGE_MAX_EDGE = 2560;
/** 有损格式的重新编码质量。 */
const IMAGE_QUALITY = 86;
/** 体积小于此值且尺寸未超限的图片不做处理。 */
const IMAGE_OPTIMIZE_THRESHOLD = 400 * 1024;
/** 输出格式 → 扩展名（jpeg 统一用 .jpg）。 */
const IMAGE_EXT: Record<string, string> = { jpeg: ".jpg", png: ".png", webp: ".webp" };

/**
 * 上传后自动压缩图片。
 *
 * - 最长边超过 IMAGE_MAX_EDGE 时等比缩小；
 * - 按格式重新编码：**无透明通道的 PNG 转 WebP**（照片类 PNG 常是十几 MB，收益最大）；
 * - **扩展名以实际内容为准**：上传文件名的后缀常与真实格式不符（例如 .png 里其实是 JPEG），
 *   这里统一按检测到的格式改写后缀，避免 /media 路由返回错误的 Content-Type；
 * - 内容已合规、只是后缀不对时只做重命名，不重新编码（不损画质）；
 * - gif / svg 不动，避免破坏动画与矢量。
 *
 * 与 createThumbnail 一样，输入输出都走内存以绕开 libvips 的文件句柄缓存。
 */
async function optimizeImage(
  absolute: string,
  relative: string
): Promise<{ relative: string; size: number }> {
  try {
    const source = await fs.readFile(absolute);
    const image = sharp(source, { failOn: "none" });
    const meta = await image.metadata();

    const expectedExt = meta.format ? IMAGE_EXT[meta.format] : undefined;
    if (!expectedExt) {
      return { relative, size: source.byteLength };
    }

    const currentExt = path.extname(relative).toLowerCase();
    const extMismatch =
      currentExt !== expectedExt && !(expectedExt === ".jpg" && currentExt === ".jpeg");
    const oversized = Math.max(meta.width ?? 0, meta.height ?? 0) > IMAGE_MAX_EDGE;
    const heavy = source.byteLength > IMAGE_OPTIMIZE_THRESHOLD;

    // 内容已合规，只是后缀与实际格式不符 → 只改名
    if (extMismatch && !oversized && !heavy) {
      const nextRelative = relative.replace(/\.[^.]+$/, expectedExt);
      await fs.rename(absolute, path.join(MEDIA_DIR, nextRelative));
      console.log(`[media] 修正扩展名 ${relative} → ${nextRelative}（内容为 ${meta.format}）`);
      return { relative: nextRelative, size: source.byteLength };
    }

    if (!extMismatch && !oversized && !heavy) {
      return { relative, size: source.byteLength };
    }

    const resized = image.resize({
      width: IMAGE_MAX_EDGE,
      height: IMAGE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });

    let output: Buffer;
    let outFormat: string;

    if (meta.format === "png" && meta.hasAlpha) {
      output = await resized.png({ compressionLevel: 9 }).toBuffer();
      outFormat = "png";
    } else if (meta.format === "png") {
      output = await resized.webp({ quality: IMAGE_QUALITY }).toBuffer();
      outFormat = "webp";
    } else if (meta.format === "jpeg") {
      output = await resized.jpeg({ quality: IMAGE_QUALITY, mozjpeg: true }).toBuffer();
      outFormat = "jpeg";
    } else {
      output = await resized.webp({ quality: IMAGE_QUALITY }).toBuffer();
      outFormat = "webp";
    }

    const nextRelative = relative.replace(/\.[^.]+$/, IMAGE_EXT[outFormat]);

    if (output.byteLength >= source.byteLength && nextRelative === relative) {
      return { relative, size: source.byteLength };
    }

    await fs.writeFile(path.join(MEDIA_DIR, nextRelative), output);

    if (nextRelative !== relative) {
      await fs.rm(absolute, { force: true }).catch(() => undefined);
    }

    console.log(
      `[media] 已压缩 ${relative} → ${nextRelative}：` +
        `${Math.round(source.byteLength / 1024)}KB → ${Math.round(output.byteLength / 1024)}KB`
    );

    return { relative: nextRelative, size: output.byteLength };
  } catch (error) {
    console.error("[media] 压缩图片失败，保留原文件：", relative, error);
    const size = await fs
      .stat(absolute)
      .then((stat) => stat.size)
      .catch(() => 0);
    return { relative, size };
  }
}

/**
 * 图片生成 WebP 缩略图；失败不影响主文件入库。
 *
 * 注意：输入与输出都绕开 sharp 的文件句柄 ——
 * 输入读成 Buffer 再交给 sharp，输出用 toBuffer() 后由 fs 写盘。
 * libvips 会缓存它打开/写出的文件句柄，导致 Windows 上刚处理过的图片
 * 无法删除（unlink 报 EPERM/EBUSY）。走内存可以完全避免。
 */
async function createThumbnail(
  absolute: string,
  relative: string,
  size: number
): Promise<string | null> {
  if (size > THUMBNAIL_MAX_SOURCE_BYTES) {
    console.warn("[media] 图片过大，跳过缩略图生成：", relative);
    return null;
  }

  try {
    const thumbRelative = `${relative.replace(/\.[^.]+$/, "")}.thumb.webp`;
    const target = path.join(MEDIA_DIR, thumbRelative);
    await fs.mkdir(path.dirname(target), { recursive: true });

    const source = await fs.readFile(absolute);

    const output = await sharp(source, { animated: false, failOn: "none" })
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    await fs.writeFile(target, output);

    return thumbRelative;
  } catch (error) {
    console.error("[media] 生成缩略图失败：", error);
    return null;
  }
}

/**
 * 视频封面：浏览器在上传时抽一帧传过来，这里统一压成 640 宽的 webp 并挂到记录上。
 *
 * 为什么要这么做：媒体库此前靠 `<video preload>` 现抽帧，每个缩略图都要真的读一段
 * 视频数据（实测约 64–200KB）。一页几十个视频就会把带宽占满 ——
 * 实测 62 个视频缩略图一次拉走 12.6MB，在慢机器上表现成「媒体库点啥都没反应」。
 * 有了真缩略图之后，媒体库只加载一张小图，**完全不碰视频文件**。
 *
 * 与 createThumbnail 一样走内存，绕开 sharp 的文件句柄缓存（Windows 上会锁文件）。
 */
export async function saveVideoThumbnail(id: number, source: Buffer): Promise<string | null> {
  const media = await prisma.media.findUnique({
    where: { id },
    select: { id: true, path: true, type: true },
  });
  if (!media || media.type !== "video") {
    return null;
  }

  // path 是我们自己写进去的 /media/xxx，仍做一次防御性检查
  const relative = media.path.replace(/^\/media\//, "").replaceAll("\\", "/");
  if (!relative || relative.split("/").some((segment) => segment.startsWith("."))) {
    return null;
  }

  try {
    const thumbRelative = `${relative.replace(/\.[^.]+$/, "")}.thumb.webp`;
    const target = path.join(MEDIA_DIR, thumbRelative);
    await fs.mkdir(path.dirname(target), { recursive: true });

    const output = await sharp(source, { animated: false, failOn: "none" })
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    await fs.writeFile(target, output);

    const publicThumb = toPublicPath(thumbRelative);
    await prisma.media.update({ where: { id }, data: { thumb: publicThumb } });
    return publicThumb;
  } catch (error) {
    console.error("[media] 保存视频封面失败：", id, error);
    return null;
  }
}

export type CompletedUpload = {
  id: number;
  path: string;
  thumb: string | null;
  type: MediaKind;
  title: string | null;
  size: string;
};

/** 合并分片 → 落盘 → 生成缩略图 → 写入媒体记录。 */
export async function completeUpload(params: {
  uploadId: string;
  fileName: string;
  size: number;
  totalChunks: number;
  title?: string | null;
  albumId?: number | null;
}): Promise<CompletedUpload> {
  assertSize(params.size);
  const kind = detectKind(params.fileName);

  const relative = buildStorageRelative(params.fileName);
  const absolute = path.join(MEDIA_DIR, relative);

  let written: number;
  try {
    written = await mergeChunks(MEDIA_DIR, params.uploadId, params.totalChunks, absolute);
  } catch (error) {
    // 分片内核抛的是 ChunkError，这里统一转成媒体域错误，避免冒泡成 500
    if (error instanceof ChunkError) {
      throw new MediaError(error.message, error.status);
    }
    throw error;
  }

  // 临时分片清理失败不应影响本次上传结果
  try {
    await discardMediaUpload(params.uploadId);
  } catch (error) {
    console.error("[media] 清理临时分片失败：", params.uploadId, error);
  }

  if (written !== params.size) {
    await fs.rm(absolute, { force: true });
    throw new MediaError(
      `上传内容不完整（期望 ${params.size} 字节，实际 ${written} 字节）`,
      400
    );
  }

  // 图片先压缩主图（上传的图常是几 MB 甚至十几 MB），再基于压缩结果生成缩略图
  let finalRelative = relative;
  let finalSize = written;

  if (kind === "image") {
    const optimized = await optimizeImage(absolute, relative);
    finalRelative = optimized.relative;
    finalSize = optimized.size;
  }

  const thumbRelative =
    kind === "image"
      ? await createThumbnail(path.join(MEDIA_DIR, finalRelative), finalRelative, finalSize)
      : null;

  const created = await prisma.media.create({
    data: {
      type: kind,
      path: toPublicPath(finalRelative),
      thumb: thumbRelative ? toPublicPath(thumbRelative) : null,
      title: params.title?.trim() || params.fileName,
      size: BigInt(finalSize),
      albumId: params.albumId ?? null,
    },
    select: { id: true, path: true, thumb: true, type: true, title: true, size: true },
  });

  return {
    id: created.id,
    path: created.path,
    thumb: created.thumb,
    type: created.type as MediaKind,
    title: created.title,
    size: created.size.toString(),
  };
}

// ---------- 查询与删除 ----------

export async function listMedia(params: { type?: MediaKind | null; albumId?: number | null; limit?: number }) {
  return prisma.media.findMany({
    where: {
      ...(params.type ? { type: params.type } : {}),
      ...(params.albumId !== undefined ? { albumId: params.albumId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 200,
    select: {
      id: true,
      type: true,
      path: true,
      thumb: true,
      title: true,
      size: true,
      createdAt: true,
      albumId: true,
      album: { select: { id: true, name: true } },
    },
  });
}

/**
 * 删除文件，带重试。
 * Windows 上 sharp 处理过的图片句柄可能短暂未释放（EPERM/EBUSY），
 * 重试几次即可；Linux（生产）无此问题。
 */
async function removeFileWithRetry(absolute: string, attempts = 5): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.rm(absolute, { force: true });
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
}

/** 删除媒体：先删文件（含缩略图），再删记录。 */
export async function deleteMedia(id: number) {
  const media = await prisma.media.findUnique({
    where: { id },
    select: { id: true, path: true, thumb: true, title: true, albumId: true },
  });

  if (!media) {
    return null;
  }

  for (const publicPath of [media.path, media.thumb]) {
    if (!publicPath) {
      continue;
    }
    try {
      await removeFileWithRetry(resolveMediaPath(relativeFromPublicPath(publicPath)));
    } catch (error) {
      // 文件删除失败不影响记录删除，但必须留下日志
      console.error("[media] 删除文件失败：", publicPath, error);
    }
  }

  await prisma.media.delete({ where: { id } });
  return media;
}

export async function updateMedia(
  id: number,
  input: { title?: string | null; albumId?: number | null }
) {
  const existing = await prisma.media.findUnique({
    where: { id },
    select: { id: true, albumId: true },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.media.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.albumId !== undefined ? { albumId: input.albumId } : {}),
    },
    select: { id: true, title: true, albumId: true },
  });

  return { updated, previousAlbumId: existing.albumId };
}

export async function ensureMediaDir(): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}
