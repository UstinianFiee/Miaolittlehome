import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { listTagsWithCount } from "@/lib/query";

type TagsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: TagsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/tags", titleKey: "nav.tags" });
}

/**
 * 贴纸的主题色占比：同一色系里循环，彼此分得开又不引入杂色。
 * 刻意不用随机色相 —— 一墙彩虹色会显得"拼贴"，和整站不搭。
 */
const MIXES = ["9%", "15%", "21%", "12%", "18%"] as const;

/** 由 id 派生一个稳定的轻微倾角（-2.5° ~ +2.5°），刷新不会跳。 */
function rotation(id: number, index: number): number {
  return (((id + index * 5) % 5) - 2) * 1.25;
}

/**
 * 标签页：**一墙小方贴纸**。
 *
 * 刻意和分类页区分开 —— 分类是「竖长条书签挂在横杆上」，标签是「方块贴纸带倾角」，
 * 形状 / 姿态 / 交互都不一样，不会看着像同一个页面换了几个字。
 *
 * 悬停时抬起并把角度归正（`rotate(0deg)`），像把歪着的贴纸按平。
 */
export default async function TagsPage({ params }: TagsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const tags = await listTagsWithCount();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">{t("site.tagsTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("site.tagsHint")}</p>

      {tags.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.tagsEmpty")}</p>
      ) : (
        <div className="mt-8 flex flex-wrap items-start gap-3">
          {tags.map((tag, index) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="tag-card press"
              style={
                {
                  "--tag-mix": MIXES[index % MIXES.length],
                  rotate: `${rotation(tag.id, index)}deg`,
                } as CSSProperties
              }
            >
              <span className="transition-colors hover:text-primary">{tag.name}</span>
              <span className="text-[0.7rem] font-normal tabular-nums text-muted-foreground">
                {t("site.postsCount", { count: tag._count.posts })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
