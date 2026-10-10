import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs/promises");
const path = require("node:path");

const MEDIA_DIR = path.resolve("uploads");
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

  await prisma.setting.updateMany({ where: { value: oldPublic }, data: { value: newPublic } });
  await prisma.post.updateMany({ where: { cover: oldPublic }, data: { cover: newPublic } });
  await prisma.album.updateMany({ where: { cover: oldPublic }, data: { cover: newPublic } });
  await prisma.video.updateMany({ where: { cover: oldPublic }, data: { cover: newPublic } });
  await prisma.software.updateMany({ where: { icon: oldPublic }, data: { icon: newPublic } });
  await prisma.friend.updateMany({ where: { avatar: oldPublic }, data: { avatar: newPublic } });
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
