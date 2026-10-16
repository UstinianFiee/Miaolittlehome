"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CommentSection } from "@/components/site/comment-section";
import { WallBoard } from "@/components/site/wall-board";
import type { CommentView } from "@/lib/comment-view";

/**
 * 留言墙：便利贴墙 + 「写留言」表单。
 *
 * **不再渲染评论列表** —— 便利贴本身就是留言的列表，下面再来一遍是重复的
 * （`CommentSection` 传 `formOnly`）。但待审提示还留着：自己刚发的留言还没上墙时，
 * 得让人看见它确实提交成功了。
 *
 * 便利贴**按时间倒序分页**（`/wall/page/N`），最新的一直在最前面。
 * 两段之间靠 `replyTarget` 联动：在便利贴的「详情」里点回复，
 * 这里接住并灌进表单（CommentSection 会滚过去）。
 *
 * `pagination` 由**服务端页面**用插槽传进来，而不是在这里 import ——
 * `SitePagination` 是 async 服务端组件（内部 `await getTranslations()`），
 * 在客户端组件里渲染会直接抛 "getTranslations is not supported in Client Components"。
 */
export function WallView({
  comments,
  count,
  page,
  totalPages,
  pagination,
}: {
  comments: CommentView[];
  count: number;
  page: number;
  totalPages: number;
  pagination?: ReactNode;
}) {
  const t = useTranslations();

  const [replyTarget, setReplyTarget] = React.useState<CommentView | null>(null);
  const handleReplied = React.useCallback(() => setReplyTarget(null), []);

  return (
    <>
      <header className="page-heading space-y-2">
        <h1 className="font-display text-2xl">{t("site.wallTitle")}</h1>
        <p className="text-muted-foreground">{t("site.wallDescription")}</p>
        <p className="text-sm text-muted-foreground">
          {t("site.wallCount", { count })}
          {totalPages > 1 ? ` · ${t("site.pageInfo", { page, totalPages })}` : ""}
        </p>
      </header>

      {comments.length === 0 ? (
        <p className="empty-state py-16 text-center text-muted-foreground">
          {t("site.wallEmpty")}
        </p>
      ) : (
        <WallBoard comments={comments} onReply={setReplyTarget} />
      )}

      {pagination}

      <CommentSection
        scope="wall"
        refId={null}
        initialComments={comments}
        count={count}
        formOnly
        replyTarget={replyTarget}
        onReplyHandled={handleReplied}
      />
    </>
  );
}
