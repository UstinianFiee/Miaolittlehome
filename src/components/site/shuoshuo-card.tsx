import { MapPinIcon } from "lucide-react";

import { formatDual } from "@/lib/datetime";
import { pickLocalized } from "@/lib/localized";
import { parseImages, type ShuoshuoRecord } from "@/lib/shuoshuo";

/**
 * 说说卡片：气泡样式。
 *
 * 刻意做得和文章卡片不一样（主题色底 + 气泡尾巴 + 头像），
 * 这样首页把长文和碎念混在一条流里时，一眼就能分清哪条是文章、哪条是随手记。
 *
 * 气泡尾巴用一小段 SVG 三角：它的底边**不描边**，正好和气泡主体融在一起，
 * 不会像「旋转 45° 的方块」那样在重叠处留下一条线。
 */
export function ShuoshuoCard({
  item,
  locale,
  siteName,
  logo,
}: {
  item: ShuoshuoRecord;
  locale: string;
  siteName: string;
  logo?: string;
}) {
  const content = pickLocalized(locale, item.content, item.contentEn);
  const images = parseImages(item.images);
  const columns = images.length === 1 ? 1 : images.length <= 4 ? 2 : 3;

  return (
    <article className="mb-4 flex gap-3 sm:gap-4">
      {/* 头像：用站点 Logo，没设就回退成主题色圆点 */}
      <div className="shrink-0">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            loading="lazy"
            className="size-9 rounded-full border border-border object-cover sm:size-10"
          />
        ) : (
          <span
            aria-hidden
            className="block size-9 rounded-full bg-primary/70 sm:size-10"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="bubble relative px-4 py-3">
          {/* 尾巴：指向左侧头像 */}
          <svg
            aria-hidden
            viewBox="0 0 8 16"
            className="absolute top-3.5 -left-[7px] h-4 w-2"
          >
            <path
              d="M8 0 L0 8 L8 16 Z"
              fill="var(--bubble-bg)"
              stroke="var(--bubble-border)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>

          <p className="text-sm leading-7 break-words whitespace-pre-wrap">{content}</p>

          {images.length > 0 ? (
            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {images.map((src, index) => (
                <a
                  key={`${index}-${src}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="media-zoom block overflow-hidden rounded-md border border-[color:var(--bubble-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className={
                      columns === 1
                        ? "max-h-64 w-auto max-w-full rounded-md object-cover"
                        : "aspect-square w-full object-cover"
                    }
                  />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {/* 元信息放在气泡外面，像聊天记录的时间 */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="font-medium text-[color:var(--card-foreground)]">{siteName}</span>
          {item.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3" />
              {item.location}
            </span>
          ) : null}
          <time dateTime={item.createdAt.toISOString()}>{formatDual(item.createdAt)}</time>
        </div>
      </div>
    </article>
  );
}
