/**
 * 媒体类型与允许上传的扩展名。
 *
 * 单独拆一个文件是为了**能在客户端组件里引用** —— `lib/media.ts` 引了
 * `node:fs` 与 `sharp`，客户端组件 import 它会直接构建失败。
 * 这里只有纯数据，服务端与客户端共用同一份，不会两边写岔。
 */

export type MediaKind = "image" | "audio" | "video";

export const MEDIA_KINDS: MediaKind[] = ["image", "audio", "video"];

/**
 * 允许上传的扩展名。
 *
 * 判定**只看扩展名**（不信任客户端的 MIME，浏览器给的 `file.type` 经常是空串）。
 * 音频/视频收得比较宽 —— 就算浏览器放不了（如 ape / wma），
 * 也还能当"放在站上供下载的文件"用，没必要卡死。
 * 真正决定"能不能播"的是浏览器，不是这个白名单。
 *
 * 刻意**不收 `.ts`**：Nginx 自带的 mime.types 把它映射成
 * `text/vnd.trolltech.linguist`（那是 Qt 翻译文件）。生产环境媒体由 Nginx 直出，
 * 会带着错误的 Content-Type 发出去，MPEG-TS 视频在浏览器里根本放不了。
 * 要放这类文件请用 `.m2ts`。
 */
export const ALLOWED_EXTENSIONS: Record<MediaKind, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"],
  audio: [
    ".mp3",
    ".m4a",
    ".wav",
    ".ogg",
    ".oga",
    ".opus",
    ".flac",
    ".aac",
    ".aif",
    ".aiff",
    ".wma",
    ".ape",
    ".mka",
    ".amr",
    ".mid",
    ".weba",
  ],
  video: [
    ".mp4",
    ".m4v",
    ".webm",
    ".mov",
    ".mkv",
    ".avi",
    ".flv",
    ".wmv",
    ".mpg",
    ".mpeg",
    ".m2ts",
    ".3gp",
    ".ogv",
    ".rmvb",
  ],
};

/**
 * 文件选择框的 `accept`。
 *
 * 用扩展名而不是 `image/*,audio/*,video/*`：后者在部分系统上会让
 * 一些冷门格式（flac / mkv）在选择器里变灰选不中。
 */
export const MEDIA_ACCEPT = Object.values(ALLOWED_EXTENSIONS).flat().join(",");

/** 便于在提示文案里列出可用格式 */
export function extensionsOf(kind: MediaKind): string {
  return ALLOWED_EXTENSIONS[kind].join(" ");
}
