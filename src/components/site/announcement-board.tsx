"use client";

import { ChevronDownIcon, MegaphoneIcon, PinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DualTime } from "@/components/site/dual-time";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AnnouncementView } from "@/lib/announcement-view";
import { cn } from "@/lib/utils";

/**
 * 单条公告。
 *
 * 置顶标识不占布局空间：左侧用一条主色竖线（绝对定位）表示，
 * 「置顶」文字放在时间行内 —— 这样所有条目的正文左边缘完全对齐。
 * 传入 onToggle 时长文本可折叠（侧边栏用），不传则完整展示（弹窗用）。
 */
function AnnouncementRow({
  item,
  expanded = false,
  onToggle,
}: {
  item: AnnouncementView;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const t = useTranslations();
  const isLong = item.content.length > 60;
  const collapsible = Boolean(onToggle) && isLong;

  const body = (
    <>
      {collapsible ? (
        <button type="button" onClick={onToggle} aria-expanded={expanded}
          className="flex w-full cursor-pointer items-start gap-2 text-left">
          <span className={cn("min-w-0 flex-1 text-sm leading-6 whitespace-pre-wrap", !expanded && "line-clamp-2")}>
            {item.content}
          </span>
          <ChevronDownIcon className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </button>
      ) : (
        <span className="block text-sm leading-6 whitespace-pre-wrap">{item.content}</span>
      )}

      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <DualTime date={item.createdAtIso} className="text-xs" />
        {item.pinned ? (
          <span className="inline-flex items-center gap-0.5 font-medium text-primary">
            <PinIcon className="size-3" />
            {t("announcements.pinned")}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li className="relative border-b border-border/60 py-3 pl-3 last:border-0">
      {/* 置顶竖线：绝对定位，不参与布局，因此不影响条目对齐 */}
      {item.pinned ? (
        <span aria-hidden className="absolute top-3.5 bottom-3.5 left-0 w-0.5 rounded-full bg-brand" />
      ) : null}

      {body}
    </li>
  );
}

/**
 * 公告板（docs/SPEC.md：置顶优先 → 日期倒序）。
 * 侧边栏展示前 N 条，其余通过「查看更多」弹窗查看。
 */
export function AnnouncementBoard({
  items,
  total,
  allItems,
}: {
  items: AnnouncementView[];
  total: number;
  allItems: AnnouncementView[];
}) {
  const t = useTranslations();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="surface p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display flex items-center gap-2 text-base">
          <MegaphoneIcon className="size-4" />
          {t("announcements.title")}
        </h2>

        {total > items.length ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="announcement-more">
                {t("announcements.more")}（{total}）
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("announcements.allTitle")}</DialogTitle>
                <DialogDescription>{t("announcements.allHint", { count: total })}</DialogDescription>
              </DialogHeader>

              <ul className="divide-y divide-border/60">
                {allItems.map((item) => (
                  <AnnouncementRow key={item.id} item={item} />
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <ul data-testid="announcement-list">
        {items.map((item) => (
          <AnnouncementRow
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        ))}
      </ul>
    </section>
  );
}
