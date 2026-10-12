"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * 「这条内容不存在」提示（文章 / 相册 / 分类 / 标签 / 视频 / 软件共用）。
 *
 * 用法：放到各动态段的 `not-found.tsx` 里，页面查到空数据时改调 `notFound()`。
 *
 * 为什么不直接在页面里 return 这段 UI：那样 HTTP 状态码仍然是 200，
 * 搜索引擎会把 `/posts/随便打的字` 这类 URL 当成有效页面收录（软 404）。
 * 走 `notFound()` 才会返回真正的 404，同时这份文案还能保留。
 */
export function EntityNotFound({
  messageKey,
  backHref,
  backKey,
}: {
  /** 文案 key，例如 "site.postNotFound" */
  messageKey: string;
  /** 返回列表页的路径（不带语言前缀） */
  backHref: string;
  /** 返回按钮文案 key */
  backKey: string;
}) {
  const t = useTranslations();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-muted-foreground">{t(messageKey)}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={backHref}>
          <ArrowLeftIcon className="size-4" />
          {t(backKey)}
        </Link>
      </Button>
    </div>
  );
}
