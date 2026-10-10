"use client";

import { MessageSquareIcon, ReplyIcon, ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CommentView } from "@/lib/comment-view";
import { formatDual } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type CommentSectionProps = {
  scope: "post" | "wall";
  refId: number | null;
  initialComments: CommentView[];
  count: number;
};

const STORAGE_KEY = "pending-comments";
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PendingComment = Omit<CommentView, "replies"> & { scope: string; refId: number | null };

/** 提交接口的返回结构（注意字段是 createdAt，不是 createdAtIso）。 */
type CommentApiPayload = {
  id: number;
  author: string;
  content: string;
  ua: string;
  browser: string;
  os: string;
  ipRegion: string;
  isAdmin: boolean;
  approved: boolean;
  parentId: number | null;
  createdAt: string;
};

function readPending(): PendingComment[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as PendingComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingComment[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // localStorage 不可用时仅本次会话可见
  }
}

function Meta({ comment, className }: { comment: CommentView; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      {comment.ipRegion ? <span>{comment.ipRegion}</span> : null}
      {comment.browser || comment.os ? (
        <span className="truncate">{[comment.browser, comment.os].filter(Boolean).join(" · ")}</span>
      ) : null}
    </div>
  );
}

/**
 * 评论头像：用昵称首字做占位，底色由昵称哈希决定。
 * 每条评论颜色稳定但彼此不同，扫一眼就能区分是谁发的；
 * 站长用主题色 + 盾牌图标单独标识。
 */
function CommentAvatar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const label = (name || "?").trim().slice(0, 1).toUpperCase();
  const hue = [...(name || "?")].reduce((sum, ch) => sum + (ch.codePointAt(0) ?? 0), 0) % 360;

  return (
    <span
      aria-hidden
      className="comment-avatar flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium"
      style={
        isAdmin
          ? {
              backgroundColor: "color-mix(in oklab, var(--primary) 20%, transparent)",
              borderColor: "color-mix(in oklab, var(--primary) 45%, transparent)",
              color: "var(--primary)",
            }
          : {
              backgroundColor: `hsl(${hue} 52% 62% / 0.26)`,
              borderColor: `hsl(${hue} 52% 55% / 0.4)`,
              color: "var(--card-foreground)",
            }
      }
    >
      {isAdmin ? <ShieldCheckIcon className="size-4" /> : label}
    </span>
  );
}

function AuthorLine({ comment }: { comment: CommentView }) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium">{comment.author || t("comments.anonymous")}</span>
      {comment.isAdmin ? (
        <Badge
          variant="secondary"
          className="gap-1 border-primary/40 bg-primary/15 text-primary"
        >
          <ShieldCheckIcon className="size-3" />
          {t("comments.siteOwner")}
        </Badge>
      ) : null}
    </div>
  );
}

function CommentBody({
  comment,
  isPending,
  onReply,
}: {
  comment: CommentView;
  isPending: boolean;
  onReply?: (comment: CommentView) => void;
}) {
  const t = useTranslations();

  return (
    <li
      className={cn(
        "rounded-lg border p-4",
        comment.isAdmin
          ? "border-primary/30 bg-primary/[0.06]"
          : "border-border/60 bg-card/40"
      )}
      data-comment-id={comment.id}
    >
      <div className="flex gap-3">
        <CommentAvatar name={comment.author} isAdmin={comment.isAdmin} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <AuthorLine comment={comment} />
            {isPending ? <Badge variant="outline">{t("comments.pendingBadge")}</Badge> : null}
            <time
              dateTime={comment.createdAtIso}
              className="ml-auto shrink-0 text-xs text-muted-foreground"
            >
              {comment.createdAtLabel}
            </time>
          </div>

          <p className="mt-1.5 text-sm leading-6 break-words whitespace-pre-wrap">
            {comment.content}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Meta comment={comment} />
            {onReply ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                onClick={() => onReply(comment)}
              >
                <ReplyIcon className="size-3.5" />
                {t("comments.reply")}
              </button>
            ) : null}
          </div>

          {comment.replies.length > 0 ? (
            <ul className="mt-3 space-y-2 border-l-2 border-primary/25 pl-3">
              {comment.replies.map((reply) => (
                <li
                  key={reply.id}
                  className="rounded-md border border-border/50 bg-background/50 p-3"
                >
                  <div className="flex gap-2.5">
                    <CommentAvatar name={reply.author} isAdmin={reply.isAdmin} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <AuthorLine comment={reply} />
                        <time
                          dateTime={reply.createdAtIso}
                          className="ml-auto shrink-0 text-xs text-muted-foreground"
                        >
                          {reply.createdAtLabel}
                        </time>
                      </div>
                      <p className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap">
                        {reply.content}
                      </p>
                      <Meta comment={reply} className="mt-1.5" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function CommentSection({ scope, refId, initialComments, count }: CommentSectionProps) {
  const t = useTranslations();

  const [pending, setPending] = React.useState<PendingComment[]>([]);
  const [replyTo, setReplyTo] = React.useState<CommentView | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const formRef = React.useRef<HTMLFormElement>(null);

  // 读取本地待审记录（仅本人可见），并清理过期项
  React.useEffect(() => {
    const now = Date.now();
    const all = readPending().filter(
      (item) => now - new Date(item.createdAtIso).getTime() < PENDING_MAX_AGE_MS
    );
    writePending(all);
    setPending(all);
  }, []);

  // 已出现在服务端列表里的本地待审项要移除（说明已通过审核），避免重复显示
  const approvedIds = React.useMemo(() => {
    const ids = new Set<number>();
    const walk = (nodes: CommentView[]) => {
      for (const node of nodes) {
        ids.add(node.id);
        walk(node.replies);
      }
    };
    walk(initialComments);
    return ids;
  }, [initialComments]);

  const visiblePending = React.useMemo(
    () =>
      pending.filter(
        (item) => item.scope === scope && item.refId === refId && !approvedIds.has(item.id)
      ),
    [pending, scope, refId, approvedIds]
  );

  const totalCount = count + visiblePending.length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          refId,
          parentId: replyTo?.id ?? null,
          author: String(data.get("author") ?? ""),
          email: String(data.get("email") ?? ""),
          content: String(data.get("content") ?? ""),
          honeypot: String(data.get("honeypot") ?? ""),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; data?: CommentApiPayload | null }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(t("comments.failed", { message: payload?.error ?? "" }));
        return;
      }

      // 蜜罐命中时服务端返回成功但 data 为 null，这里静默处理
      if (payload.data) {
        const entry: PendingComment = {
          id: payload.data.id,
          author: payload.data.author,
          content: payload.data.content,
          ua: payload.data.ua,
          browser: payload.data.browser,
          os: payload.data.os,
          ipRegion: payload.data.ipRegion,
          isAdmin: payload.data.isAdmin,
          approved: payload.data.approved,
          parentId: payload.data.parentId,
          createdAtIso: payload.data.createdAt,
          createdAtLabel: formatDual(new Date(payload.data.createdAt)),
          scope,
          refId,
        };

        const next = [...readPending(), entry];
        writePending(next);
        setPending(next);
      }

      setNotice(t("comments.pendingNotice"));
      setReplyTo(null);
      form.reset();
    } catch {
      setError(t("comments.failed", { message: "" }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="surface mt-12 p-6 sm:p-7" id="comments">
      <h2 className="font-display flex items-center gap-2 text-lg">
        <MessageSquareIcon className="size-4" />
        {t("comments.title")}
        <span className="text-sm font-normal text-muted-foreground">
          {t("comments.count", { count: totalCount })}
        </span>
      </h2>

      {visiblePending.length > 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">{t("comments.pendingHint")}</p>
          <ul className="mt-3 space-y-3">
            {visiblePending.map((item) => (
              <CommentBody
                key={`pending-${item.id}`}
                comment={{ ...item, replies: [] } as CommentView}
                isPending
              />
            ))}
          </ul>
        </div>
      ) : null}

      {initialComments.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("comments.empty")}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {initialComments.map((comment) => (
            <CommentBody
              key={comment.id}
              comment={comment}
              isPending={false}
              onReply={(target) => {
                setReplyTo(target);
                formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("comments.formTitle")}</h3>
          {replyTo ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t("comments.replyTo", { name: replyTo.author })}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                {t("comments.cancelReply")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="comment-author">{t("comments.nickname")}</Label>
            <Input id="comment-author" name="author" maxLength={30} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment-email">{t("comments.email")}</Label>
            <Input id="comment-email" name="email" type="email" maxLength={100} />
            <p className="text-xs text-muted-foreground">{t("comments.emailHint")}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment-content">{t("comments.content")}</Label>
          <Textarea id="comment-content" name="content" rows={5} maxLength={1000} required />
          <p className="text-xs text-muted-foreground">{t("comments.contentHint")}</p>
        </div>

        {/* 蜜罐：对访客隐藏，机器人常会填写 */}
        <div aria-hidden className="hidden">
          <label htmlFor="comment-honeypot">honeypot</label>
          <input id="comment-honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
        </div>

        {notice ? (
          <p role="status" className="text-sm text-primary">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? t("comments.submitting") : t("comments.submit")}
        </Button>
      </form>
    </section>
  );
}
