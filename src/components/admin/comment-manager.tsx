"use client";

import { CheckIcon, Trash2Icon, UndoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

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
import { formatDual } from "@/lib/datetime";

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

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    pending: `${t("comments.filterPending")} (${counts.pending})`,
    approved: `${t("comments.filterApproved")} (${counts.approved})`,
    all: `${t("comments.filterAll")} (${counts.total})`,
  };

  async function mutate(id: number, run: () => Promise<Response>) {
    setPendingId(id);
    setError(null);

    try {
      const response = await run();
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("comments.approveFailed", { message: payload?.error ?? "" }));
        return;
      }
      router.refresh();
    } catch {
      setError(t("comments.approveFailed", { message: "" }));
    } finally {
      setPendingId(null);
    }
  }

  function setApproved(id: number, approved: boolean) {
    return mutate(id, () =>
      fetch(`/api/admin/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      })
    );
  }

  function remove(item: AdminCommentItem) {
    if (!window.confirm(t("comments.deleteConfirm"))) {
      return;
    }
    return mutate(item.id, () => fetch(`/api/admin/comments/${item.id}`, { method: "DELETE" }));
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

      <div className="surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">{t("comments.colAuthor")}</TableHead>
              <TableHead>{t("comments.colContent")}</TableHead>
              <TableHead className="w-40">{t("comments.colTarget")}</TableHead>
              <TableHead className="w-24">{t("comments.colStatus")}</TableHead>
              <TableHead className="w-56">{t("comments.colTime")}</TableHead>
              <TableHead className="w-56 text-right">{t("comments.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t("comments.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
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
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDual(new Date(item.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {item.approved ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === item.id}
                          onClick={() => void setApproved(item.id, false)}
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
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
