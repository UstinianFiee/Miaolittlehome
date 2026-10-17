"use client";

import { ALLOWED_EXTENSIONS } from "@/lib/media-extensions";

/**
 * 视频封面：在**上传时**由浏览器抽一帧，交给服务端落成真缩略图。
 *
 * 为什么值得这么做：服务端没有 ffmpeg，以前媒体库只能靠 `<video preload>` 现抽帧 ——
 * 每个缩略图都要真的读一段视频数据（实测约 64–200KB），一页几十个视频就把带宽占满
 * （62 个 = 12.6MB），慢机器上表现为「媒体库点啥都没反应」。
 * 改成上传时抽帧后，媒体库只加载一张几 KB 的小图，**完全不碰视频文件**。
 *
 * 这一整套都是「尽力而为」：任何一步失败都静默返回，绝不影响主文件的上传结果。
 */

/** 抽帧的目标时间点（秒）。太靠前容易是黑场/台标。 */
const FRAME_AT_SECONDS = 1;
/** 画布最长边，避免 4K 视频把内存吃满；服务端还会再压到 640。 */
const MAX_CANVAS_EDGE = 1280;
const LOAD_TIMEOUT_MS = 20_000;

export function isVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.video.some((ext) => name.endsWith(ext));
}

/** 用 canvas 从视频里抽一帧，返回 webp（不支持则退回 jpeg）。src 可以是 blob: 或同源地址。 */
async function grabFrame(src: string): Promise<Blob | null> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("metadata timeout")), LOAD_TIMEOUT_MS);
      video.addEventListener(
        "loadedmetadata",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      video.addEventListener(
        "error",
        () => {
          window.clearTimeout(timer);
          reject(new Error("decode error"));
        },
        { once: true }
      );
      video.src = src;
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }

    // 目标时间不超过时长（短视频只有 0.x 秒时取 1s 会 seek 失败）
    const duration = Number.isFinite(video.duration) ? video.duration : FRAME_AT_SECONDS;
    const target = Math.max(0, Math.min(FRAME_AT_SECONDS, duration - 0.1));

    if (target > 0) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 8000);
        video.addEventListener(
          "seeked",
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
        video.currentTime = target;
      });
    }

    const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const webp = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/webp", 0.85)
    );
    if (webp) {
      return webp;
    }
    // Safari 老版本不支持 canvas 输出 webp
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85)
    );
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
  }
}

/** 从本地文件抽帧（上传流程用）。 */
export async function extractVideoFrame(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    return await grabFrame(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function postThumbnail(mediaId: number, frame: Blob): Promise<boolean> {
  try {
    const response = await fetch(`/api/admin/media/${mediaId}/thumb`, {
      method: "POST",
      headers: { "Content-Type": frame.type || "image/webp" },
      body: frame,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 上传成功后调用：是视频就补一张封面。任何失败都不抛。 */
export async function attachVideoThumbnail(
  file: File,
  mediaId: number | undefined
): Promise<boolean> {
  if (!mediaId || !isVideoFile(file)) {
    return false;
  }
  const frame = await extractVideoFrame(file);
  return frame ? postThumbnail(mediaId, frame) : false;
}

/**
 * 给**已有的**视频补封面（上传时还没有这个功能的那些）。
 * 直接从服务端地址抽帧 —— 同源，canvas 不会被污染。
 */
export async function backfillVideoThumbnail(mediaId: number, src: string): Promise<boolean> {
  const frame = await grabFrame(src);
  return frame ? postThumbnail(mediaId, frame) : false;
}
