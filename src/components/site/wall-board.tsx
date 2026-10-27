"use client";

import { InfoIcon, ReplyIcon, ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DualTime } from "@/components/site/dual-time";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CommentView } from "@/lib/comment-view";

/**
 * 留言墙：小板子 + 便利贴。
 *
 * 设计取向：
 * - **便利贴的颜色跟着主题走** —— 用 `color-mix(primary, card)` 混色而不是俗套的黄/粉/蓝，
 *   深浅主题自动切换，和站点整体不割裂。每张用不同的 primary 占比，同一色系里彼此分得开。
 * - **文字用站点的展示字体**（`font-display`），这样墙读起来是"站内的东西"而不是第三方组件。
 * - **点一下翻面**：正面是内容，背面是发言人（昵称 / 归属地 / 浏览器 / 系统 / 时间）。
 * - **「详情」弹窗**：完整内容 + 全部回复，并且可以直接从这里发起回复。
 *
 * 布局用响应式 grid（不用 CSS columns 瀑布流）：
 * columns 会把「绝对定位的子元素（胶带）」在多列里重复投影，
 * 实测第二/三张纸条的胶带会跑到隔壁纸条上/下面；grid 没有这个问题。
 * 每张纸条带一个固定的轻微倾角 —— 手贴便利贴不可能完全对齐，倾角是"对"的一部分。
 */

/** 每张便利贴的 primary 占比，循环取，保证相邻的几张不一样 */
const NOTE_MIXES = ["8%", "13%", "18%", "11%", "16%"] as const;
const NOTE_PREVIEW_LIMIT = 120;

function getNotePreview(content: string) {
  const characters = Array.from(content);
  return {
    text: characters.slice(0, NOTE_PREVIEW_LIMIT).join(""),
    truncated: characters.length > NOTE_PREVIEW_LIMIT,
  };
}

/** 由 id 派生一个稳定的倾角（-2.5° ~ +2.5°），刷新不会跳 */
function noteRotation(id: number, index: number): number {
  return (((id + index * 7) % 5) - 2) * 1.25;
}

function Speaker({ comment }: { comment: CommentView }) {
  const t = useTranslations();

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
            comment.isAdmin
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border/60 bg-background/60"
          )}
        >
          {comment.isAdmin ? (
            <ShieldCheckIcon className="size-4" />
          ) : (
            (comment.author || "?").trim().slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{comment.author || t("comments.anonymous")}</p>
          {comment.isAdmin ? (
            <p className="text-[0.8rem] leading-[1.6] text-primary">{t("comments.siteOwner")}</p>
          ) : null}
        </div>
      </div>

      {/*
        标签列必须 shrink-0 + nowrap：「发布于」这种两字标签在窄纸条里
        会被挤成「发布」/「于」两行，看着像坏了。让它固定，由右侧的值换行。
      */}
      <dl className="space-y-1.5 text-[0.8rem] leading-[1.6] text-muted-foreground">
        {comment.ipRegion ? (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 whitespace-nowrap">{t("comments.fromRegion")}</dt>
            <dd className="min-w-0 text-right break-words text-[color:var(--card-foreground)]">
              {comment.ipRegion}
            </dd>
          </div>
        ) : null}
        {comment.browser || comment.os ? (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 whitespace-nowrap">{t("comments.fromEnv")}</dt>
            <dd className="min-w-0 text-right break-words text-[color:var(--card-foreground)]">
              {[comment.browser, comment.os].filter(Boolean).join(" · ")}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 whitespace-nowrap">{t("comments.postedAt")}</dt>
          <dd className="min-w-0 text-right">
            <DualTime date={comment.createdAtIso} variant="stacked" className="items-end" />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Note({
  comment,
  index,
  onDetail,
}: {
  comment: CommentView;
  index: number;
  onDetail: (comment: CommentView) => void;
}) {
  const t = useTranslations();
  const [flipped, setFlipped] = React.useState(false);
  const preview = getNotePreview(comment.content);

  return (
    <div
      className={cn("flip-card", flipped && "flipped")}
      style={{ rotate: `${noteRotation(comment.id, index)}deg` }}
      onClick={() => setFlipped((value) => !value)}
      role="button"
      tabIndex={0}
      aria-expanded={flipped}
      // 键盘也要能翻：回车 / 空格
      onKeyDown={(event) => {
        // 内部的「展开全文 / 详情」是原生按钮，不要抢它自己的键盘激活事件。
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setFlipped((value) => !value);
        }
      }}
    >
      {/*
        胶带必须放在 .flip-inner（preserve-3d 翻转容器）**外面**：
        preserve-3d 会把带 transform 的子元素做 3D 投影，实测第二张纸条的
        胶带会被投影到隔壁纸条下方（看起来像"贴到别的纸条下面"）。
        放在 .flip-card 里只做 2D 定位就不会跑。
      */}
      <span aria-hidden className="sticky-tape" />
      <div className="flip-inner">
        {/* 正面：内容 */}
        {/*
          正面保留 min-h 让短内容也有"纸条感"；高度由 flip-inner 的 grid 取
          正/背面较高的一侧，背面内容再长也不会被裁掉（之前背面被 overflow-hidden 裁过）。
        */}
        <div
          className="sticky-note flip-face flex min-h-[11.5rem] flex-col rounded-md p-4 pt-5"
          style={{ "--note-mix": NOTE_MIXES[index % NOTE_MIXES.length] } as React.CSSProperties}
        >
          <p className="font-display text-sm leading-7 break-words whitespace-pre-wrap">
            {preview.text}
            {preview.truncated ? (
              <button
                type="button"
                className="ml-0.5 inline rounded-sm text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t("comments.expandContent")}
                title={t("comments.expandContent")}
                onClick={(event) => {
                  event.stopPropagation();
                  onDetail(comment);
                }}
              >
                …
              </button>
            ) : null}
          </p>
          <p className="mt-auto flex items-center gap-2 pt-3 text-[0.8rem] leading-[1.6] text-muted-foreground">
            {comment.replies.length > 0 ? (
              <span>
                {comment.replies.length} {t("comments.repliesLabel")}
              </span>
            ) : null}
            <DualTime date={comment.createdAtIso} className="ml-auto" />
          </p>
        </div>

        {/* 背面：发言人信息 + 详情（grid 叠在同一格，高度取较高的一面） */}
        <div className="flip-back" aria-hidden={!flipped}>
          <div
            className="sticky-note flip-face flex h-full flex-col rounded-md p-4"
            style={{ "--note-mix": NOTE_MIXES[index % NOTE_MIXES.length] } as React.CSSProperties}
          >
            <Speaker comment={comment} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full max-sm:h-11"
              // 未翻面时背面不可见，别让键盘 Tab 进到看不见的按钮
              tabIndex={flipped ? undefined : -1}
              // 别再让外层那张卡的点击把牌翻回去
              onClick={(event) => {
                event.stopPropagation();
                onDetail(comment);
              }}
            >
              <InfoIcon className="size-3.5" />
              {t("comments.detail")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WallBoard({
  comments,
  onReply,
}: {
  comments: CommentView[];
  /** 从某张便利贴发起回复（由外层接到评论表单上） */
  onReply: (comment: CommentView) => void;
}) {
  const t = useTranslations();
  const [detail, setDetail] = React.useState<CommentView | null>(null);

  return (
    <>
      <div className="board mt-6 p-4 sm:p-5">
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comments.map((comment, index) => (
            <Note
              key={comment.id}
              comment={comment}
              index={index}
              onDetail={setDetail}
            />
          ))}
        </div>
      </div>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="min-w-0 sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader className="min-w-0">
                <DialogTitle className="font-display break-words">{t("comments.detailTitle")}</DialogTitle>
              </DialogHeader>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                <article className="rounded-lg border border-border/60 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 break-words font-medium">{detail.author || t("comments.anonymous")}</span>
                    {detail.isAdmin ? (
                      <span className="shrink-0 rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[0.8rem] text-primary">
                        {t("comments.siteOwner")}
                      </span>
                    ) : null}
                    <DualTime
                      date={detail.createdAtIso}
                      className="ml-auto shrink-0 text-[0.8rem] text-muted-foreground"
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">
                    {detail.content}
                  </p>
                  <p className="mt-2 text-[0.8rem] leading-[1.6] text-muted-foreground">
                    {[detail.ipRegion, detail.browser, detail.os].filter(Boolean).join(" · ")}
                  </p>
                </article>

                {detail.replies.length > 0 ? (
                  <ul className="space-y-2 border-l-2 border-primary/25 pl-3">
                    {detail.replies.map((reply) => (
                      <li key={reply.id} className="rounded-md border border-border/50 bg-background/50 p-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="min-w-0 break-words text-sm font-medium">
                            {reply.author || t("comments.anonymous")}
                          </span>
                          {reply.isAdmin ? (
                            <span className="shrink-0 rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[0.8rem] text-primary">
                              {t("comments.siteOwner")}
                            </span>
                          ) : null}
                          <DualTime
                            date={reply.createdAtIso}
                            className="ml-auto shrink-0 text-[0.8rem] text-muted-foreground"
                          />
                        </div>
                        <p className="mt-1.5 text-sm leading-6 break-words whitespace-pre-wrap">
                          {reply.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state py-6 text-center text-sm text-muted-foreground">
                    {t("comments.noReplies")}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="max-sm:h-11"
                  onClick={() => {
                    onReply(detail);
                    setDetail(null);
                  }}
                >
                  <ReplyIcon className="size-3.5" />
                  {t("comments.reply")}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
