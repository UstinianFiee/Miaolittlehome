import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type { Prisma } from "@prisma/client";

import { MEDIA_DIR } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { getSiteInfo } from "@/lib/settings";
import { SOFTWARE_DIR } from "@/lib/software-storage";
import { ZipWriter } from "@/lib/zip";

/**
 * 内容导出 / 导入（迁移服务器用）。
 *
 * ## 和 `scripts/backup.sh` 的区别
 *
 * `scripts/backup.sh` 是**运维级**的：把整个 `/data`（含 SQLite 数据库文件本身）打成 tar.gz，
 * 恢复时要停服、整目录覆盖，只能在同版本之间用。
 *
 * 这里是**应用级**的：导出的是「内容」，与数据库文件格式无关，跨版本可用，
 * 后台点一下就行，用来把一台服务器上的文章/说说搬到另一台。
 *
 * ## 包里有什么
 *
 * ```
 * backup.json         所有内容表的原始数据（含 id 与时间戳）
 * media/...           媒体文件（可选，对应 MEDIA_DIR）
 * software/...        软件安装包（可选，对应 SOFTWARE_DIR，通常很大）
 * ```
 *
 * ## 几个刻意的决定
 *
 * - **不导出 User**。密码哈希跨库迁移没有意义，也不安全。
 *   新服务器首次部署时 `RUN_SEED=true` 会用环境变量建好管理员，导入后直接用它登录。
 * - **不导出日志**（OperationLog / VisitLog）。那是运行痕迹，不是内容。
 * - **导入 = 完整还原**：清空现有内容后按包里的数据重建。
 *   为了不让人误操作丢数据，导入前会自动把**当前**数据导出成一份快照存在 BACKUP_DIR。
 * - **导入不删除多余的媒体文件**：只做覆盖写入。删文件不可逆，而多几个孤儿文件只是占点磁盘。
 */

export const BACKUP_FORMAT = "blog-content-backup";
export const BACKUP_FORMAT_VERSION = 1;

/** 备份暂存目录：分片上传的临时文件、导入前的自动快照都放这里 */
export const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR ?? "./backups");

/** 单个备份包上限。ZIP 经典格式（未启用 ZIP64）的硬上限是 4GB，这里对齐它。 */
export const BACKUP_MAX_SIZE = 4 * 1024 * 1024 * 1024 - 1;

export class BackupError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BackupError";
    this.status = status;
  }
}

// ---------- 导出：数据 ----------

export type BackupTableName =
  | "categories"
  | "tags"
  | "posts"
  | "postTags"
  | "albums"
  | "media"
  | "videos"
  | "software"
  | "softwareFiles"
  | "announcements"
  | "shuoshuo"
  | "friends"
  | "comments"
  | "settings";

export type BackupCounts = Record<BackupTableName, number>;

/**
 * 备份包里的数据（「线上格式」）。
 *
 * 直接复用 Prisma 的 `CreateManyInput`，好处是导入时的 `createMany` 天然类型对齐；
 * 只需要把 BigInt 字段换成字符串（JSON 不能直接序列化 BigInt）。
 */
export type ImportData = {
  categories: Prisma.CategoryCreateManyInput[];
  tags: Prisma.TagCreateManyInput[];
  posts: Prisma.PostCreateManyInput[];
  postTags: Prisma.PostTagCreateManyInput[];
  albums: Prisma.AlbumCreateManyInput[];
  media: Prisma.MediaCreateManyInput[];
  videos: Prisma.VideoCreateManyInput[];
  software: Prisma.SoftwareCreateManyInput[];
  softwareFiles: Prisma.SoftwareFileCreateManyInput[];
  announcements: Prisma.AnnouncementCreateManyInput[];
  shuoshuo: Prisma.ShuoshuoCreateManyInput[];
  friends: Prisma.FriendCreateManyInput[];
  comments: Prisma.CommentCreateManyInput[];
  settings: Prisma.SettingCreateManyInput[];
};

/** 导出的数据：与 `ImportData` 同构，只是 BigInt 换成了字符串。 */
export type BackupData = Omit<ImportData, "media" | "softwareFiles"> & {
  media: (Omit<Prisma.MediaCreateManyInput, "size"> & { size: string })[];
  softwareFiles: (Omit<Prisma.SoftwareFileCreateManyInput, "fileSize"> & { fileSize: string })[];
};

/** 读出全库内容。BigInt 转成字符串，Date 交给 JSON.stringify 转 ISO。 */
export async function collectBackupData(): Promise<BackupData> {
  const [
    categories,
    tags,
    posts,
    postTags,
    albums,
    media,
    videos,
    software,
    softwareFiles,
    announcements,
    shuoshuo,
    friends,
    comments,
    settings,
  ] = await Promise.all([
    prisma.category.findMany({ orderBy: { id: "asc" } }),
    prisma.tag.findMany({ orderBy: { id: "asc" } }),
    prisma.post.findMany({ orderBy: { id: "asc" } }),
    prisma.postTag.findMany(),
    prisma.album.findMany({ orderBy: { id: "asc" } }),
    prisma.media.findMany({ orderBy: { id: "asc" } }),
    prisma.video.findMany({ orderBy: { id: "asc" } }),
    prisma.software.findMany({ orderBy: { id: "asc" } }),
    prisma.softwareFile.findMany({ orderBy: { id: "asc" } }),
    prisma.announcement.findMany({ orderBy: { id: "asc" } }),
    prisma.shuoshuo.findMany({ orderBy: { id: "asc" } }),
    prisma.friend.findMany({ orderBy: { id: "asc" } }),
    prisma.comment.findMany({ orderBy: { id: "asc" } }),
    prisma.setting.findMany({ orderBy: { key: "asc" } }),
  ]);

  return {
    categories,
    tags,
    posts,
    postTags: postTags.map((row) => ({ postId: row.postId, tagId: row.tagId })),
    albums,
    media: media.map((row) => ({ ...row, size: row.size.toString() })),
    videos,
    software,
    softwareFiles: softwareFiles.map((row) => ({ ...row, fileSize: row.fileSize.toString() })),
    announcements,
    shuoshuo,
    friends,
    comments,
    settings,
  };
}

export function countBackupData(data: { [K in BackupTableName]: readonly unknown[] }): BackupCounts {
  return {
    categories: data.categories.length,
    tags: data.tags.length,
    posts: data.posts.length,
    postTags: data.postTags.length,
    albums: data.albums.length,
    media: data.media.length,
    videos: data.videos.length,
    software: data.software.length,
    softwareFiles: data.softwareFiles.length,
    announcements: data.announcements.length,
    shuoshuo: data.shuoshuo.length,
    friends: data.friends.length,
    comments: data.comments.length,
    settings: data.settings.length,
  };
}

// ---------- 导出：文件 ----------

export type BackupFileEntry = { entry: string; absolute: string; size: number };

export type BackupFileOptions = { media: boolean; software: boolean };

/** 递归收集目录下的文件。跳过隐藏项（`.tmp` 这类临时目录不该进备份包）。 */
async function walkFiles(root: string, prefix: string, out: BackupFileEntry[]): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    // 目录不存在（例如还没上传过任何东西）就当作空
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolute = path.join(root, entry.name);
    const relative = `${prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await walkFiles(absolute, relative, out);
    } else if (entry.isFile()) {
      const stat = await fsp.stat(absolute);
      out.push({ entry: relative, absolute, size: stat.size });
    }
  }
}

export async function collectBackupFiles(options: BackupFileOptions): Promise<BackupFileEntry[]> {
  const files: BackupFileEntry[] = [];
  if (options.media) {
    await walkFiles(MEDIA_DIR, "media", files);
  }
  if (options.software) {
    await walkFiles(SOFTWARE_DIR, "software", files);
  }
  return files;
}

// ---------- 导出：组装 ----------

export type BackupArchiveSummary = {
  counts: BackupCounts;
  files: { media: number; software: number; bytes: number };
};

export type PreparedBackup = {
  payload: Buffer;
  files: BackupFileEntry[];
  summary: BackupArchiveSummary;
};

/**
 * 收集数据与文件清单，并做大小预检。
 *
 * 拆出这一步是为了**能在开始写流之前报错**：HTTP 导出一旦开始写响应头，
 * 状态码就定死了，这时再发现超限只能让用户下到一个坏包。
 */
export async function prepareBackup(options: BackupFileOptions): Promise<PreparedBackup> {
  const [data, files, site] = await Promise.all([
    collectBackupData(),
    collectBackupFiles(options),
    getSiteInfo(),
  ]);

  const counts = countBackupData(data);
  const bytes = files.reduce((total, file) => total + file.size, 0);

  const payload = Buffer.from(
    JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      siteName: site.name,
      includes: options,
      counts,
      data,
    }),
    "utf8"
  );

  if (payload.byteLength + bytes + 1024 * 1024 > BACKUP_MAX_SIZE) {
    throw new BackupError("备份包超过 4GB 上限，请取消勾选「软件安装包」后重试", 413);
  }

  return {
    payload,
    files,
    summary: {
      counts,
      files: {
        media: files.filter((file) => file.entry.startsWith("media/")).length,
        software: files.filter((file) => file.entry.startsWith("software/")).length,
        bytes,
      },
    },
  };
}

/**
 * 把预检好的备份写进给定的输出流。
 *
 * 调用方决定输出到哪：HTTP 响应（浏览器下载）或磁盘文件（导入前的自动快照）。
 * 全程流式，不在内存里攒整包。
 */
export async function writePreparedArchive(
  out: Writable,
  prepared: PreparedBackup
): Promise<void> {
  const writer = new ZipWriter(out);
  await writer.addBuffer("backup.json", prepared.payload, true);
  for (const file of prepared.files) {
    await writer.addFile(file.entry, file.absolute);
  }
  await writer.finish();
}

/** 预检 + 写入一步到位（快照这类不关心 HTTP 状态码的场景用）。 */
export async function writeBackupArchive(
  out: Writable,
  options: BackupFileOptions
): Promise<BackupArchiveSummary> {
  const prepared = await prepareBackup(options);
  await writePreparedArchive(out, prepared);
  return prepared.summary;
}

/** 生成一个带时间戳、纯 ASCII 的文件名（放进 Content-Disposition 不会有编码问题）。 */
export function backupFileName(prefix = "blog-backup"): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}.zip`;
}

/** 把当前数据存一份快照到 BACKUP_DIR，返回文件名。导入前自动调用。 */
export async function writeSafetySnapshot(): Promise<{ fileName: string; bytes: number }> {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const fileName = backupFileName("snapshot");
  const target = path.join(BACKUP_DIR, fileName);

  const out = fs.createWriteStream(target);
  try {
    // 快照只带媒体文件，不含动辄上 G 的软件安装包
    await writeBackupArchive(out, { media: true, software: false });
  } catch (error) {
    out.destroy();
    await fsp.rm(target, { force: true }).catch(() => undefined);
    throw error;
  }

  const stat = await fsp.stat(target);
  return { fileName, bytes: stat.size };
}

// ---------- 导入 ----------

export type ImportSummary = {
  counts: BackupCounts;
  snapshot: { fileName: string; bytes: number } | null;
  files: { written: number };
  warnings: string[];
};

// ---------- 取值与校验 ----------

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    try {
      return BigInt(value);
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

function asDate(value: unknown, fallback: Date): Date {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asArray(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new BackupError(`备份包缺少或损坏：${field}`);
  }
  return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
}

const CATEGORY_TYPES = ["post", "video", "software"] as const;
const COMMENT_TYPES = ["post", "wall"] as const;
const MEDIA_TYPES = ["image", "audio", "video"] as const;
const VIDEO_SOURCES = ["local", "iframe"] as const;
const PLATFORMS = ["windows", "macos", "linux", "android", "ios"] as const;

type BackupFile = {
  format: string;
  formatVersion: number;
  exportedAt: string;
  siteName: string;
  counts: BackupCounts;
  data: ImportData;
};

/** 解析并校验 backup.json。只挑认识的字段，多余的键一律忽略。 */
export function parseBackupFile(raw: Buffer): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new BackupError("backup.json 不是合法的 JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new BackupError("备份包内容不正确");
  }

  const root = parsed as Record<string, unknown>;
  if (root.format !== BACKUP_FORMAT) {
    throw new BackupError("这不是本站导出的备份包");
  }

  const formatVersion = asInt(root.formatVersion, 0);
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      `备份包版本（v${formatVersion}）比当前程序新，请先升级站点再导入`
    );
  }

  const data = (root.data ?? {}) as Record<string, unknown>;

  const categories = asArray(data.categories, "分类").map((row) => ({
    id: asInt(row.id),
    name: asText(row.name),
    nameEn: asNullableText(row.nameEn),
    type: asEnum(row.type, CATEGORY_TYPES, "post"),
    sort: asInt(row.sort),
  }));

  const tags = asArray(data.tags, "标签").map((row) => ({
    id: asInt(row.id),
    name: asText(row.name),
    slug: asText(row.slug),
  }));

  const posts = asArray(data.posts, "文章").map((row) => ({
    id: asInt(row.id),
    title: asText(row.title),
    titleEn: asNullableText(row.titleEn),
    slug: asText(row.slug),
    summary: asText(row.summary),
    summaryEn: asNullableText(row.summaryEn),
    content: asText(row.content),
    contentEn: asNullableText(row.contentEn),
    cover: asNullableText(row.cover),
    categoryId: asNullableInt(row.categoryId),
    published: asBool(row.published),
    pinned: asBool(row.pinned),
    views: asInt(row.views),
    createdAt: asDate(row.createdAt, new Date()),
    updatedAt: asDate(row.updatedAt, new Date()),
  }));

  const postTags = asArray(data.postTags, "文章标签").map((row) => ({
    postId: asInt(row.postId),
    tagId: asInt(row.tagId),
  }));

  const albums = asArray(data.albums, "相册").map((row) => ({
    id: asInt(row.id),
    name: asText(row.name),
    nameEn: asNullableText(row.nameEn),
    cover: asNullableText(row.cover),
    description: asNullableText(row.description),
    sort: asInt(row.sort),
    createdAt: asDate(row.createdAt, new Date()),
  }));

  const media = asArray(data.media, "媒体").map((row) => ({
    id: asInt(row.id),
    type: asEnum(row.type, MEDIA_TYPES, "image"),
    path: asText(row.path),
    thumb: asNullableText(row.thumb),
    albumId: asNullableInt(row.albumId),
    title: asNullableText(row.title),
    size: asBigInt(row.size),
    createdAt: asDate(row.createdAt, new Date()),
  }));

  const videos = asArray(data.videos, "视频").map((row) => ({
    id: asInt(row.id),
    title: asText(row.title),
    titleEn: asNullableText(row.titleEn),
    cover: asNullableText(row.cover),
    sourceType: asEnum(row.sourceType, VIDEO_SOURCES, "local"),
    srcUrl: asText(row.srcUrl),
    description: asNullableText(row.description),
    published: asBool(row.published),
    pinned: asBool(row.pinned),
    sort: asInt(row.sort),
    createdAt: asDate(row.createdAt, new Date()),
    updatedAt: asDate(row.updatedAt, new Date()),
  }));

  const software = asArray(data.software, "软件").map((row) => ({
    id: asInt(row.id),
    name: asText(row.name),
    nameEn: asNullableText(row.nameEn),
    icon: asNullableText(row.icon),
    description: asText(row.description),
    published: asBool(row.published),
    sort: asInt(row.sort),
    createdAt: asDate(row.createdAt, new Date()),
    updatedAt: asDate(row.updatedAt, new Date()),
  }));

  const softwareFiles = asArray(data.softwareFiles, "安装包").map((row) => ({
    id: asInt(row.id),
    softwareId: asInt(row.softwareId),
    version: asText(row.version),
    platform: asEnum(row.platform, PLATFORMS, "windows"),
    fileName: asText(row.fileName),
    filePath: asText(row.filePath),
    fileSize: asBigInt(row.fileSize),
    downloads: asInt(row.downloads),
    createdAt: asDate(row.createdAt, new Date()),
  }));

  const announcements = asArray(data.announcements, "公告").map((row) => ({
    id: asInt(row.id),
    content: asText(row.content),
    pinned: asBool(row.pinned),
    published: asBool(row.published, true),
    createdAt: asDate(row.createdAt, new Date()),
    updatedAt: asDate(row.updatedAt, new Date()),
  }));

  const shuoshuo = asArray(data.shuoshuo, "说说").map((row) => ({
    id: asInt(row.id),
    content: asText(row.content),
    contentEn: asNullableText(row.contentEn),
    images: asText(row.images, "[]"),
    location: asNullableText(row.location),
    published: asBool(row.published, true),
    pinned: asBool(row.pinned),
    createdAt: asDate(row.createdAt, new Date()),
    updatedAt: asDate(row.updatedAt, new Date()),
  }));

  const friends = asArray(data.friends, "友链").map((row) => ({
    id: asInt(row.id),
    name: asText(row.name),
    url: asText(row.url),
    avatar: asNullableText(row.avatar),
    description: asNullableText(row.description),
    sort: asInt(row.sort),
  }));

  const comments = asArray(data.comments, "评论").map((row) => ({
    id: asInt(row.id),
    type: asEnum(row.type, COMMENT_TYPES, "post"),
    refId: asNullableInt(row.refId),
    author: asText(row.author),
    email: asNullableText(row.email),
    content: asText(row.content),
    ua: asText(row.ua),
    browser: asText(row.browser),
    os: asText(row.os),
    ipRegion: asText(row.ipRegion),
    ipHash: asNullableText(row.ipHash),
    parentId: asNullableInt(row.parentId),
    isAdmin: asBool(row.isAdmin),
    approved: asBool(row.approved),
    createdAt: asDate(row.createdAt, new Date()),
  }));

  const settings = asArray(data.settings, "站点设置").map((row) => ({
    key: asText(row.key),
    value: asText(row.value),
  }));

  return {
    format: BACKUP_FORMAT,
    formatVersion,
    exportedAt: asText(root.exportedAt),
    siteName: asText(root.siteName),
    counts: (root.counts ?? {}) as BackupCounts,
    data: {
      categories,
      tags,
      posts,
      postTags,
      albums,
      media,
      videos,
      software,
      softwareFiles,
      announcements,
      shuoshuo,
      friends,
      comments,
      settings,
    },
  };
}

/**
 * 评论是自引用的（`parentId`），必须父节点先入库，否则外键会挡。
 * 正常导出时 id 升序就天然满足，这里仍然做一次拓扑排序，
 * 顺便把「父节点在包外」的孤儿回复降级成顶层评论，避免整包导入失败。
 *
 * `CommentRow` 把 `id` 收窄成必填：Prisma 的 CreateManyInput 里 `id` 是可选的
 * （不传就让数据库自增），但解析过的备份数据里一定带着 id。
 */
type CommentRow = ImportData["comments"][number] & { id: number };

function orderComments(rows: CommentRow[]): CommentRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const inserted = new Set<number>();
  const ordered: CommentRow[] = [];
  let pending = [...rows];

  while (pending.length > 0) {
    const deferred: typeof pending = [];
    let progressed = false;

    for (const row of pending) {
      // Prisma 的 CreateManyInput 里 parentId 是 `number | null | undefined`，先归一成 null
      const parentId = row.parentId ?? null;
      const parentKnown = parentId !== null && byId.has(parentId);

      if (parentId === null || inserted.has(parentId)) {
        ordered.push(row);
        inserted.add(row.id);
        progressed = true;
      } else if (!parentKnown) {
        // 父节点不在备份包里（可能只导出了部分数据）→ 提升为顶层
        ordered.push({ ...row, parentId: null });
        inserted.add(row.id);
        progressed = true;
      } else {
        deferred.push(row);
      }
    }

    if (!progressed) {
      // 理论上不会走到这里（有环）。兜底：剩下的全部断开父引用后按原序插入。
      for (const row of deferred) {
        ordered.push({ ...row, parentId: null });
        inserted.add(row.id);
      }
      break;
    }
    pending = deferred;
  }

  return ordered;
}

/** 逆依赖顺序清空（先删引用方，再删被引用方）。 */
async function clearContent(tx: Prisma.TransactionClient) {
  await tx.postTag.deleteMany();
  await tx.post.deleteMany();
  await tx.tag.deleteMany();
  await tx.category.deleteMany();
  await tx.media.deleteMany();
  await tx.album.deleteMany();
  await tx.softwareFile.deleteMany();
  await tx.software.deleteMany();
  await tx.comment.deleteMany();
  await tx.video.deleteMany();
  await tx.announcement.deleteMany();
  await tx.shuoshuo.deleteMany();
  await tx.friend.deleteMany();
  await tx.setting.deleteMany();
}

/**
 * 把备份数据整体写进数据库。
 *
 * 全程在一个事务里：要么全成，要么全部回滚 —— 导入到一半失败留下半套数据最难受。
 * 超时给到 10 分钟（SQLite 本地写入很快，这个值只是防御）。
 */
export async function applyBackupData(data: ImportData): Promise<BackupCounts> {
  const comments = orderComments(data.comments as CommentRow[]);

  return prisma.$transaction(
    async (tx) => {
      await clearContent(tx);

      await tx.category.createMany({ data: data.categories });
      await tx.tag.createMany({ data: data.tags });
      await tx.post.createMany({ data: data.posts });
      if (data.postTags.length > 0) {
        await tx.postTag.createMany({ data: data.postTags });
      }

      await tx.album.createMany({ data: data.albums });
      await tx.media.createMany({ data: data.media });

      await tx.video.createMany({ data: data.videos });
      await tx.software.createMany({ data: data.software });
      if (data.softwareFiles.length > 0) {
        await tx.softwareFile.createMany({ data: data.softwareFiles });
      }

      await tx.announcement.createMany({ data: data.announcements });
      await tx.shuoshuo.createMany({ data: data.shuoshuo });
      await tx.friend.createMany({ data: data.friends });

      if (comments.length > 0) {
        await tx.comment.createMany({ data: comments });
      }

      if (data.settings.length > 0) {
        await tx.setting.createMany({ data: data.settings });
      }

      return countBackupData(data);
    },
    { timeout: 600_000, maxWait: 60_000 }
  );
}

/**
 * 把包里的条目名解析成磁盘上的目标路径。
 *
 * 返回 null 表示这条不该落盘（`backup.json` 本身，或将来包里新增的未知前缀）——
 * 忽略未知前缀是有意的：以后往包里加东西时，旧版本导入不会直接失败。
 */
export function resolveBackupTarget(entryName: string): string | null {
  let root: string;
  let relative: string;

  if (entryName === "backup.json") {
    return null;
  }
  if (entryName.startsWith("media/")) {
    root = MEDIA_DIR;
    relative = entryName.slice("media/".length);
  } else if (entryName.startsWith("software/")) {
    root = SOFTWARE_DIR;
    relative = entryName.slice("software/".length);
  } else {
    return null;
  }

  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === ".." || segment === ".")) {
    throw new BackupError(`备份包里含有非法路径：${entryName}`);
  }

  const target = path.resolve(root, normalized);
  if (!target.startsWith(root + path.sep)) {
    throw new BackupError(`备份包里的路径越界：${entryName}`);
  }

  return target;
}

// ---------- 统计（给后台页面显示） ----------

export type BackupStats = {
  counts: BackupCounts;
  media: { files: number; bytes: number };
  software: { files: number; bytes: number };
};

export async function backupStats(): Promise<BackupStats> {
  const [data, mediaFiles, softwareFiles] = await Promise.all([
    collectBackupData(),
    collectBackupFiles({ media: true, software: false }),
    collectBackupFiles({ media: false, software: true }),
  ]);

  const sum = (files: BackupFileEntry[]) => files.reduce((total, file) => total + file.size, 0);

  return {
    counts: countBackupData(data),
    media: { files: mediaFiles.length, bytes: sum(mediaFiles) },
    software: { files: softwareFiles.length, bytes: sum(softwareFiles) },
  };
}

/** 清理过期的暂存文件（分片目录与导入用的 zip），按小时节流。 */
const STAGE_TTL_MS = 24 * 60 * 60 * 1000;
let lastStageSweepAt = 0;

export async function sweepStaging(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastStageSweepAt < 60 * 60 * 1000) {
    return;
  }
  lastStageSweepAt = now;

  let entries: string[];
  try {
    entries = await fsp.readdir(path.join(BACKUP_DIR, ".stage"));
  } catch {
    return;
  }

  for (const name of entries) {
    const target = path.join(BACKUP_DIR, ".stage", name);
    try {
      const stat = await fsp.stat(target);
      if (now - stat.mtimeMs > STAGE_TTL_MS) {
        await fsp.rm(target, { recursive: true, force: true });
      }
    } catch {
      // 单个清理失败不影响其它
    }
  }
}
