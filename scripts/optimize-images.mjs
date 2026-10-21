import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs/promises");
const path = require("node:path");

// 媒体目录与运行时保持一致：生产是 /data/media（由 MEDIA_DIR 环境变量指定），开发默认 ./uploads。
// 之前这里写死 "uploads"，在服务器上直接执行会扫错目录、静默什么都不处理。
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR ?? "uploads");
const MAX_EDGE = 2560;
const QUALITY = 86;
const THRESHOLD = 400 * 1024;

/** 输出格式 → 扩展名。注意 jpeg 用 .jpg。 */
const EXT = { jpeg: ".jpg", png: ".png", webp: ".webp" };

const prisma = new PrismaClient();

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".tmp") continue;
      out.push(...(await walk(full)));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name) && !entry.name.includes(".thumb.")) {
      out.push(full);
    }
  }
  return out;
}

/** 更新所有可能引用该图片的字段（含改名的情况）。 */
async function syncReferences(oldPublic, newPublic, size) {
  await prisma.media.updateMany({
    where: { path: oldPublic },
    data: { path: newPublic, size: BigInt(size) },
  });

  if (oldPublic === newPublic) return;

  // 单值字段：整个字段就是一个路径，精确匹配的 updateMany 就够
  await prisma.setting.updateMany({ where: { value: oldPublic }, data: { value: newPublic } });
  await prisma.post.updateMany({ where: { cover: oldPublic }, data: { cover: newPublic } });
  await prisma.album.updateMany({ where: { cover: oldPublic }, data: { cover: newPublic } });
  await prisma.video.updateMany({ where: { cover: oldPublic }, data: { cover: newPublic } });
  await prisma.software.updateMany({ where: { icon: oldPublic }, data: { icon: newPublic } });
  await prisma.friend.updateMany({ where: { avatar: oldPublic }, data: { avatar: newPublic } });

  // JSON 字段里的引用：上面的精确匹配改不到，必须解析后逐项替换
  await syncJsonReferences(oldPublic, newPublic);
}

/** 存 JSON 的设置键：值是数组或对象，里面可能包含媒体路径。 */
const JSON_SETTING_KEYS = ["site.backgrounds", "profile.links", "playlist"];

/** 递归把 JSON 结构中「与旧路径完全相等」的字符串替换成新路径。 */
function replaceJsonPath(value, oldPath, newPath) {
  if (typeof value === "string") {
    return value === oldPath ? newPath : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceJsonPath(item, oldPath, newPath));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceJsonPath(item, oldPath, newPath)])
    );
  }
  return value;
}

/**
 * 同步 JSON 字段里的媒体引用。
 *
 * 之前只更新「整字段等于旧路径」的文本列，下面这些地方仍指着已被改名 / 删除的文件，
 * 表现为前台图片 404：
 * - Setting.site.backgrounds（JSON 字符串数组，首页轮播背景图）
 * - Setting.profile.links（JSON 对象数组，自定义链接）
 * - Setting.playlist（JSON 对象数组，曲目封面 cover）
 * - Shuoshuo.images（JSON 字符串数组，说说配图）
 * 单值设置（site.background / site.logo / profile.avatar / site.pageBackground 等）已由上面的
 * 精确匹配 updateMany 覆盖，这里不重复处理。
 */
async function syncJsonReferences(oldPath, newPath) {
  const settings = await prisma.setting.findMany({
    where: { key: { in: JSON_SETTING_KEYS } },
    select: { key: true, value: true },
  });

  for (const row of settings) {
    let parsed;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      console.log(`跳过  Setting.${row.key}（不是合法 JSON，未改动）`);
      continue;
    }

    const next = JSON.stringify(replaceJsonPath(parsed, oldPath, newPath));
    if (next !== JSON.stringify(parsed)) {
      await prisma.setting.update({ where: { key: row.key }, data: { value: next } });
      console.log(`更新引用  Setting.${row.key}`);
    }
  }

  const notes = await prisma.shuoshuo.findMany({
    where: { images: { contains: oldPath } },
    select: { id: true, images: true },
  });

  for (const note of notes) {
    let parsed;
    try {
      parsed = JSON.parse(note.images);
    } catch {
      console.log(`跳过  Shuoshuo#${note.id}（images 不是合法 JSON，未改动）`);
      continue;
    }

    const next = JSON.stringify(replaceJsonPath(parsed, oldPath, newPath));
    if (next !== note.images) {
      await prisma.shuoshuo.update({ where: { id: note.id }, data: { images: next } });
      console.log(`更新引用  Shuoshuo#${note.id}.images`);
    }
  }
}

const files = await walk(MEDIA_DIR);
console.log(`扫描到 ${files.length} 个图片文件\n`);

let changed = 0;
let savedBytes = 0;

for (const absolute of files) {
  const relative = path.relative(MEDIA_DIR, absolute).split(path.sep).join("/");
  const source = await fs.readFile(absolute);
  const image = sharp(source, { failOn: "none" });
  const meta = await image.metadata();

  const expectedExt = meta.format ? EXT[meta.format] : undefined;
  if (!expectedExt) {
    console.log(`跳过  ${relative}（格式 ${meta.format} 不处理）`);
    continue;
  }

  const currentExt = path.extname(relative).toLowerCase();
  const extMismatch =
    currentExt !== expectedExt && !(expectedExt === ".jpg" && currentExt === ".jpeg");
  const needsResize = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE;
  const needsRecode = source.byteLength > THRESHOLD;

  const oldPublic = `/media/${relative}`;

  // 情况 1：内容已合规，只是扩展名与实际格式不符 → 只改名，不重新编码（不损画质）
  if (extMismatch && !needsResize && !needsRecode) {
    const nextRelative = relative.replace(/\.[^.]+$/, expectedExt);
    await fs.rename(absolute, path.join(MEDIA_DIR, nextRelative));
    await syncReferences(oldPublic, `/media/${nextRelative}`, source.byteLength);
    changed += 1;
    console.log(`改名  ${relative} → ${nextRelative}（内容已是 ${meta.format}，未重新编码）`);
    continue;
  }

  // 情况 2：已经够小且尺寸合规 → 不动
  if (!extMismatch && !needsResize && !needsRecode) {
    console.log(`跳过  ${relative}（${Math.round(source.byteLength / 1024)}KB，已合规）`);
    continue;
  }

  // 情况 3：重新编码（缩放 + 转码），扩展名以输出格式为准
  const resized = image.resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });

  let output;
  let outFormat;

  if (meta.format === "png" && meta.hasAlpha) {
    output = await resized.png({ compressionLevel: 9 }).toBuffer();
    outFormat = "png";
  } else if (meta.format === "png") {
    output = await resized.webp({ quality: QUALITY }).toBuffer();
    outFormat = "webp";
  } else if (meta.format === "jpeg") {
    output = await resized.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
    outFormat = "jpeg";
  } else {
    output = await resized.webp({ quality: QUALITY }).toBuffer();
    outFormat = "webp";
  }

  const nextRelative = relative.replace(/\.[^.]+$/, EXT[outFormat]);

  if (output.byteLength >= source.byteLength && nextRelative === relative) {
    console.log(`跳过  ${relative}（压缩后未变小）`);
    continue;
  }

  await fs.writeFile(path.join(MEDIA_DIR, nextRelative), output);
  if (nextRelative !== relative) {
    await fs.rm(absolute, { force: true }).catch(() => undefined);
  }

  await syncReferences(oldPublic, `/media/${nextRelative}`, output.byteLength);

  savedBytes += source.byteLength - output.byteLength;
  changed += 1;
  console.log(
    `压缩  ${relative}${nextRelative !== relative ? ` → ${nextRelative}` : ""}  ` +
      `${Math.round(source.byteLength / 1024)}KB → ${Math.round(output.byteLength / 1024)}KB`
  );
}

await prisma.$disconnect();
console.log(`\n完成：处理 ${changed} 个文件，共节省 ${Math.round(savedBytes / 1024)} KB`);
