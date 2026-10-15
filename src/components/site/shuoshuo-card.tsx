import { MapPinIcon } from "lucide-react";

import { DualTime } from "@/components/site/dual-time";
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
 * 尾巴在 DOM 上排在气泡**前面**（不是气泡的子元素），气泡的不透明底色会盖住它的根部。
 * 这样有两个好处：
 *
 * 1. 路径**不闭合**（`M14 1 C10 5 6 7 2 8 C6 9 10 12 14 17`，没有 `Z`），
 *    所以只有两段外沿被描边 —— 不会像「旋转 45° 的方块」那样在接缝处留下一条竖线。
 * 2. 尾巴向右多伸进气泡 2px，被气泡底色盖住，填充与气泡之间不会出现发丝缝。
 *
 * 所以 `--bubble-bg` **必须是不透明的**，否则根部会透出来叠成深色块。
 */
export function ShuoshuoCard({
  item,
  locale,
  siteName,
  avatar,
}: {
  item: ShuoshuoRecord;
  locale: string;
  siteName: string;
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
            src={avatar}
            alt=""
            loading="lazy"
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
          {/* 尾巴：指向左侧头像。排在气泡前面，根部被气泡底色盖住 */}
          <svg
            aria-hidden
            viewBox="0 0 14 18"
            className="absolute top-3 -left-3 h-[18px] w-[14px]"
          >
            <path
              d="M14 1 C10 5 6 7 2 8 C6 9 10 12 14 17"
              fill="var(--bubble-bg)"
              stroke="var(--bubble-border)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          <div className="bubble relative px-4 py-4 sm:px-5">
            <p className="bubble-author mb-2 text-sm break-words">{siteName}</p>
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
                      src={src}
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
            <div className="bubble-meta mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 text-xs">
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
