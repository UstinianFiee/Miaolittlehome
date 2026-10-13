"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { CommentSection } from "@/components/site/comment-section";
import { WallBoard } from "@/components/site/wall-board";
import type { CommentView } from "@/lib/comment-view";

/**
 * 留言墙：便利贴墙 + 评论区。
 *
 * 两段之间靠 `replyTarget` 联动：在便利贴的「详情」里点回复，
 * 这里接住并灌进评论表单（CommentSection 会滚过去）。
 */
export function WallView({
  comments,
  count,
}: {
  comments: CommentView[];
  count: number;
}) {
  const t = useTranslations();

  const [replyTarget, setReplyTarget] = React.useState<CommentView | null>(null);
  const handleReplied = React.useCallback(() => setReplyTarget(null), []);

  return (
    <>
      <h1 className="font-display text-2xl">{t("site.wallTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("site.wallDescription")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("comments.count", { count })}
      </p>

      {comments.length === 0 ? (
        <p className="empty-state py-16 text-center text-muted-foreground">
          {t("site.wallEmpty")}
        </p>
      ) : (
        <WallBoard comments={comments} onReply={setReplyTarget} />
      )}

      <CommentSection
        scope="wall"
        refId={null}
        initialComments={comments}
        count={count}
        replyTarget={replyTarget}
        onReplyHandled={handleReplied}
      />
    </>
  );
}
