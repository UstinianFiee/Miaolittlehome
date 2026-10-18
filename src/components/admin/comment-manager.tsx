"use client";

import { CheckIcon, Trash2Icon, UndoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DualTime } from "@/components/site/dual-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AdminCommentItem = {
  id: number;
  author: string;
  email: string | null;
  content: string;
  ua: string;
  browser: string;
  os: string;
  ipRegion: string;
  approved: boolean;
  parentId: number | null;
  /** 父留言是否已通过审核；顶层留言为 null。 */
  parentApproved: boolean | null;
  /** 该条下面的回复数量。 */
  replyCount: number;
  createdAt: string;
  refType: string;
  post: { id: number; title: string; slug: string } | null;
};

type CommentManagerProps = {
  items: AdminCommentItem[];
  status: string;
  page: number;
  totalPages: number;
  total: number;
  counts: { pending: number; approved: number; total: number };
};

const FILTERS = ["pending", "approved", "all"] as const;

export function CommentManager({
  items,
  status,
  page,
  totalPages,
  total,
  counts,
}: CommentManagerProps) {
  const t = useTranslations();
  const router = useRouter();

  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    pending: `${t("comments.filterPending")} (${counts.pending})`,
    approved: `${t("comments.filterApproved")} (${counts.approved})`,
    all: `${t("comments.filterAll")} (${counts.total})`,
  };

  async function mutate(id: number, run: () => Promise<Response>, onDone?: (data: unknown) => void) {
    setPendingId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await run();
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("comments.approveFailed", { message: payload?.error ?? "" }));
        return;
      }

      const payload = (await response.json().catch(() => null)) as { data?: unknown } | null;
      onDone?.(payload?.data);
      router.refresh();
    } catch {
      setError(t("comments.approveFailed", { message: "" }));
    } finally {
      setPendingId(null);
    }
  }

  function setApproved(id: number, approved: boolean) {
    return mutate(
      id,
      () =>
        fetch(`/api/admin/comments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved }),
        }),
      (data) => {
        // 通过回复时后端会把上级一并通过，这里明确告诉管理员，
        // 否则「我明明只点了一条，怎么别处也变了」会让人困惑。
        const cascaded = (data as { cascaded?: number[] } | null)?.cascaded ?? [];
        if (approved && cascaded.length > 0) {
          setNotice(t("comments.cascaded", { count: cascaded.length }));
        }
      }
    );
  }

  function remove(item: AdminCommentItem) {
    const message =
      item.replyCount > 0
        ? t("comments.deleteWithReplies", { count: item.replyCount })
        : t("comments.deleteConfirm");

    if (!window.confirm(message)) {
      return;
    }
    return mutate(item.id, () => fetch(`/api/admin/comments/${item.id}`, { method: "DELETE" }));
  }

  function reject(item: AdminCommentItem) {
    // 退回顶层留言会让它下面的回复在前台一起消失，先说清楚
    if (item.replyCount > 0) {
      const message = t("comments.rejectWithReplies", { count: item.replyCount });
      if (!window.confirm(message)) {
        return;
      }
    }
    return setApproved(item.id, false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("comments.adminTitle")}</h1>
        <div className="flex gap-2">
          {FILTERS.map((value) => (
            <Button
              key={value}
              variant={status === value ? "default" : "outline"}
              size="sm"
              onClick={() =>
                router.push(value === "pending" ? "/admin/comments" : `/admin/comments?status=${value}`)
              }
            >
              {filterLabels[value]}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      ) : null}

      {/* 手机端：评论表格改成卡片，正文、来源和审核操作不再被横向裁掉 */}
      <div className="space-y-3 lg:hidden">
        {items.length === 0 ? (
          <p className="surface empty-state py-10 text-center text-sm text-muted-foreground">
            {t("comments.empty")}
          </p>
        ) : (
          items.map((item) => {
            const parentPending = item.parentId !== null && item.parentApproved === false;

            return (
              <article key={item.id} className="surface space-y-2.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{item.author}</span>
                      {item.parentId !== null ? (
                        <Badge variant="outline">{t("comments.reply")}</Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[item.email, item.ipRegion].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge
                    variant={item.approved ? "default" : "outline"}
                    className="shrink-0"
                  >
                    {item.approved
                      ? t("comments.statusApproved")
                      : t("comments.statusPending")}
                  </Badge>
                </div>

                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {item.content}
                </p>

                {parentPending ? (
                  <Badge
                    variant="outline"
                    className="w-fit border-destructive/50 text-destructive"
                    title={t("comments.parentPendingHint")}
                  >
                    {t("comments.parentPending")}
                  </Badge>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {item.post ? (
                    <a
                      href={`/zh/posts/${item.post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-full truncate underline-offset-4 hover:underline"
                    >
                      {item.post.title}
                    </a>
                  ) : (
                    <span>{t("comments.wallSource")}</span>
                  )}
                  <span aria-hidden>·</span>
                  <span className="truncate">
                    {[item.browser, item.os].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <DualTime date={item.createdAt} className="text-xs text-muted-foreground" />
                  <div className="flex gap-1">
                    {item.approved ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === item.id}
                        onClick={() => void reject(item)}
                      >
                        <UndoIcon className="size-4" />
                        {t("comments.reject")}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === item.id}
                        onClick={() => void setApproved(item.id, true)}
                      >
                        <CheckIcon className="size-4" />
                        {t("comments.approve")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("comments.delete")}
                      disabled={pendingId === item.id}
                      onClick={() => void remove(item)}
                    >
                      <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="surface hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">{t("comments.colAuthor")}</TableHead>
              <TableHead>{t("comments.colContent")}</TableHead>
              <TableHead className="w-40">{t("comments.colTarget")}</TableHead>
              <TableHead className="w-28">{t("comments.colStatus")}</TableHead>
              <TableHead className="w-44">{t("comments.colTime")}</TableHead>
              <TableHead className="w-56 text-right">{t("comments.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="empty-state py-10 text-center text-muted-foreground">
                  {t("comments.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const parentPending = item.parentId !== null && item.parentApproved === false;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-medium">{item.author}</span>
                      {item.parentId !== null ? (
                        <Badge variant="outline" className="ml-2">
                          {t("comments.reply")}
                        </Badge>
                      ) : null}
                      {item.email ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.email}
                        </span>
                      ) : null}
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.ipRegion || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <p className="truncate text-sm" title={item.content}>
                        {item.content}
                      </p>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[item.browser, item.os].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.post ? (
                        <a
                          href={`/zh/posts/${item.post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-4 hover:underline"
                        >
                          {item.post.title}
                        </a>
                      ) : (
                        t("comments.wallSource")
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.approved ? "default" : "outline"}>
                        {item.approved ? t("comments.statusApproved") : t("comments.statusPending")}
                      </Badge>
                      {/*
                        关键提示：回复只有在整条上级链都通过后才在前台可见。
                        以前这里不提示，管理员只通过回复就会以为已经发布，实际看不到。
                      */}
                      {parentPending ? (
                        <Badge
                          variant="outline"
                          className="mt-1 block w-fit border-destructive/50 text-destructive"
                          title={t("comments.parentPendingHint")}
                        >
                          {t("comments.parentPending")}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <DualTime date={item.createdAt} variant="stacked" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {item.approved ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendingId === item.id}
                            onClick={() => void reject(item)}
                          >
                            <UndoIcon className="size-4" />
                            {t("comments.reject")}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendingId === item.id}
                            onClick={() => void setApproved(item.id, true)}
                          >
                            <CheckIcon className="size-4" />
                            {t("comments.approve")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("comments.delete")}
                          disabled={pendingId === item.id}
                          onClick={() => void remove(item)}
                        >
                          <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("site.pageInfo", { page, totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                router.push(status === "pending" ? "/admin/comments" : `/admin/comments?status=${status}&page=${page - 1}`)
              }
            >
              {t("site.prevPage")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() =>
                router.push(`/admin/comments?status=${status}&page=${page + 1}`)
              }
            >
              {t("site.nextPage")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("comments.count", { count: total })}</p>
      )}
    </div>
  );
}
