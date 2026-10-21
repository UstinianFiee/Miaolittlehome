import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { MEDIA_DIR } from "@/lib/media";
import { serveStaticFile } from "@/lib/serve-file";

/**
 * 按需缩放的图片直出：`/img/<宽>/<媒体相对路径>`。
 *
 * ## 为什么需要它
 *
 * 首页的封面图、页面背景图、文章封面都是**上传原图直出**（实测单张 643KB），
 * 在 2Mbps 的机器上一张就要 2.5 秒。而展示尺寸根本用不到原图分辨率。
 *
 * ## 为什么用 `/img/` 而不是给 `/media/` 加查询参数
 *
 * 生产环境 `/media/` 由 Nginx `alias` 直出（带 Range，视频要靠它），
 * **不会经过应用**，查询参数会被无视 —— 加了也不生效。
 * `/img/` 前缀没有专门的 Nginx location，会落到 `location /` 被反代到应用，
 * 所以**不需要改任何 Nginx 配置**就能生效。
 *
 * ## 缓存
 *
 * 转码结果写到 `MEDIA_DIR` 旁边的 `.imgcache/`（不放 `/media/` 里面，
 * 免得被 Nginx 直接暴露）。源文件比缓存新就重新生成。
 * 生成的 URL 带宽度且文件名本身是内容哈希，所以可以长缓存。
 */

const ALLOWED_WIDTHS = new Set([128, 256, 640, 1280, 1920]);
/** 只对这些位图转码；gif / svg 等原样直出，避免破坏动图或矢量。 */
const TRANSFORMABLE = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const CACHE_ROOT = path.join(path.dirname(MEDIA_DIR), ".imgcache");

type Params = { params: Promise<{ w: string; path: string[] }> };

export async function GET(request: Request, { params }: Params) {
  const { w, path: segments } = await params;
  const width = Number(w);
  const relative = segments.map((segment) => decodeURIComponent(segment)).join("/");

  const passthrough = () => serveStaticFile(request, relative, { root: MEDIA_DIR, cacheSeconds: 2592000 });

  // 宽度不在白名单 / 路径不合法 / 格式不转码 → 直接给原图，行为等同于 /media/
  if (!ALLOWED_WIDTHS.has(width)) {
    return passthrough();
  }
  if (!relative || relative.split("/").some((segment) => segment.startsWith("."))) {
    return passthrough();
  }

  const ext = path.extname(relative).toLowerCase();
  if (!TRANSFORMABLE.has(ext)) {
    return passthrough();
  }

  const source = path.resolve(MEDIA_DIR, relative);
  if (!source.startsWith(MEDIA_DIR + path.sep)) {
    return passthrough();
  }

  const cached = path.join(CACHE_ROOT, String(width), `${relative}.webp`);

  try {
    const [sourceStat, cachedStat] = await Promise.all([
      fs.stat(source),
      fs.stat(cached).catch(() => null),
    ]);

    if (!sourceStat.isFile()) {
      return passthrough();
    }

    if (!cachedStat || cachedStat.mtimeMs < sourceStat.mtimeMs) {
      const input = await fs.readFile(source);
      const output = await sharp(input, { animated: false, failOn: "none" })
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();

      await fs.mkdir(path.dirname(cached), { recursive: true });
      await fs.writeFile(cached, output);
    }

    const body = await fs.readFile(cached);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(body.length),
        // 文件名是内容哈希 + 宽度固定，可以长缓存
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    // 转码失败不能让图片挂掉，退回原图
    console.error("[img] 缩放失败，回退原图：", relative, error);
    return passthrough();
  }
}
