/**
 * 图片 URL 工具：把 `/media/xxx` 换成按需缩放的 `/img/<宽>/xxx`。
 *
 * 首页的封面、背景、文章封面用的都是上传原图（单张可达 600KB+），
 * 在慢机器上光图片就要好几秒。走 `/img/` 让服务端转成对应宽度的 webp
 * （见 `src/app/img/[w]/[...path]/route.ts`）。
 *
 * 非 `/media/` 开头的地址（外链、data URI、绝对 URL）原样返回，不做处理。
 *
 * 宽度档位：128/256 给 Logo、头像、播放器封面这类小图用（上传原图可能 2560 宽，
 * 直接塞进几十 px 的展示位是纯粹的流量浪费）；640/1280/1920 给封面与背景。
 */
export type ImageWidth = 128 | 256 | 640 | 1280 | 1920;

export function resizedImageUrl(src: string | null | undefined, width: ImageWidth): string {
  if (!src) {
    return "";
  }
  if (!src.startsWith("/media/")) {
    return src;
  }
  return `/img/${width}${src.slice("/media".length)}`;
}
