import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * 静态文件直出（开发环境用）。
 * 媒体库与软件安装包共用：两者只差根目录与 MIME 表。
 *
 * 生产环境这两类文件都由 Nginx 直出，不经过本模块。
 */

export const COMMON_MIME_TYPES: Record<string, string> = {
  ".7z": "application/x-7z-compressed",
  ".aac": "audio/aac",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".amr": "audio/amr",
  ".apk": "application/vnd.android.package-archive",
  ".ape": "audio/x-ape",
  ".appimage": "application/octet-stream",
  ".avi": "video/x-msvideo",
  ".avif": "image/avif",
  ".deb": "application/vnd.debian.binary-package",
  ".dmg": "application/x-apple-diskimage",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".flac": "audio/flac",
  ".flv": "video/x-flv",
  ".gif": "image/gif",
  ".gz": "application/gzip",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m2ts": "video/mp2t",
  ".m4a": "audio/mp4",
  ".m4v": "video/x-m4v",
  ".mid": "audio/midi",
  ".mka": "audio/x-matroska",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".msi": "application/x-msi",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".ogv": "video/ogg",
  ".opus": "audio/ogg",
  ".pkg": "application/octet-stream",
  ".png": "image/png",
  ".rar": "application/vnd.rar",
  ".rmvb": "application/vnd.rn-realmedia-vbr",
  ".rpm": "application/x-rpm",
  ".svg": "image/svg+xml",
  ".tar": "application/x-tar",
  ".tgz": "application/gzip",
  ".ts": "video/mp2t",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".wma": "audio/x-ms-wma",
  ".wmv": "video/x-ms-wmv",
  ".zip": "application/zip",
};

export type ServeOptions = {
  /** 允许的根目录；解析后的路径必须落在其中 */
  root: string;
  /** 下载时强制以附件形式返回 */
  downloadName?: string | null;
  cacheSeconds?: number;
};

function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404 });
}

/** 支持 Range 的文件直出；越界、隐藏路径、目录一律 404。 */
export async function serveStaticFile(
  request: Request,
  relative: string,
  options: ServeOptions
): Promise<NextResponse> {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.split("/").some((segment) => segment.startsWith("."))) {
    return notFound();
  }

  const absolute = path.resolve(options.root, normalized);
  if (!absolute.startsWith(options.root + path.sep)) {
    return notFound();
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolute);
  } catch {
    return notFound();
  }

  if (!stat.isFile()) {
    return notFound();
  }

  const contentType =
    COMMON_MIME_TYPES[path.extname(absolute).toLowerCase()] ?? "application/octet-stream";

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": `public, max-age=${options.cacheSeconds ?? 3600}`,
  };

  if (options.downloadName) {
    headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(options.downloadName)}`;
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;

      if (Number.isNaN(start) || start > end || start >= stat.size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }

      const length = end - start + 1;
      const buffer = Buffer.alloc(length);
      const handle = await fs.open(absolute, "r");
      try {
        await handle.read(buffer, 0, length, start);
      } finally {
        await handle.close();
      }

      return new NextResponse(new Uint8Array(buffer), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": String(length),
        },
      });
    }
  }

  const file = await fs.readFile(absolute);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
