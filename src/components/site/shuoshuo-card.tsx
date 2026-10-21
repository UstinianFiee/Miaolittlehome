import { MapPinIcon } from "lucide-react";

import { DualTime } from "@/components/site/dual-time";
import { resizedImageUrl } from "@/lib/image-url";
import { pickLocalized } from "@/lib/localized";
import { parseImages, type ShuoshuoRecord } from "@/lib/shuoshuo";

/**
 * 说说卡片：气泡样式。
 *
 * 刻意做得和文章卡片不一样（主题色底 + 气泡尾巴 + 头像），
 * 这样首页把长文和碎念混在一条流里时，一眼就能分清哪条是文章、哪条是随手记。
 *
 * ## 尾巴为什么长这样
 *
 * 尾巴是 `.bubble` 的**兄弟节点**（`position: absolute`，不占布局），不是气泡内部元素。
 * 旋转 45° 的方块只露左半边，根部被气泡矩形遮住 —— 这样气泡边框天然连续，
 * 不会出现「用 SVG 去补边框」时常见的亚像素接缝（见 globals.css 的 `.bubble-tail` 注释）。
 *
 * ## 署名
 *
 * 气泡顶部显示的是**作者名**（`profile.name` → 站点 `author` 兜底），不是站点名；
 * 站点名只出现在导航 / 页脚。
 */
export function ShuoshuoCard({
  item,
  locale,
  authorName,
  avatar,
}: {
  item: ShuoshuoRecord;
  locale: string;
  authorName: string;
  /** 头像：取「关于」页设置的那个，没设再回退到站点 Logo */
  avatar?: string;
}) {
  const content = pickLocalized(locale, item.content, item.contentEn);
  const images = parseImages(item.images);
  const columns = images.length === 1 ? 1 : images.length <= 4 ? 2 : 3;

  return (
    <article className="shuoshuo-card mb-5 flex items-start gap-3 sm:gap-4">
      {/* 头像：关于页设置的头像，没设就回退成主题色圆点 */}
      <div className="shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resizedImageUrl(avatar, 128)}
            alt=""
            loading="lazy"
            decoding="async"
            className="bubble-avatar size-9 rounded-full object-cover sm:size-10"
          />
        ) : (
          <span
            aria-hidden
            className="bubble-avatar block size-9 rounded-full bg-primary sm:size-10"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative">
          <span aria-hidden className="bubble-tail" />
          <div className="bubble relative px-4 py-4 sm:px-5">
            <p className="bubble-author mb-2 text-sm break-words">{authorName}</p>
            <p className="text-sm leading-7 break-words whitespace-pre-wrap">{content}</p>

            {images.length > 0 ? (
              <div
                className="mt-3 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {images.map((src, index) => (
                  // 配图不再单独描边：气泡本身已有边框，再套一层会变成「框中框」
                  <a
                    key={`${index}-${src}`}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="media-zoom block overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resizedImageUrl(src, 640)}
                      alt=""
                      loading="lazy"
                      className={
                        columns === 1
                          ? "max-h-64 w-auto max-w-full rounded-lg object-cover"
                          : "aspect-square w-full object-cover"
                      }
                    />
                  </a>
                ))}
              </div>
            ) : null}
            {/* 元信息也放在气泡实色底上，避免直接压在背景图上发灰。 */}
            <div className="bubble-meta mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 text-[0.8rem] leading-[1.6]">
              <DualTime date={item.createdAt} />
              {item.location ? (
                <span className="inline-flex min-w-0 items-center gap-1 break-words">
                  <MapPinIcon className="size-3 shrink-0" />
                  {item.location}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
