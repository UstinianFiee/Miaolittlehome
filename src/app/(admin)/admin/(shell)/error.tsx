"use client";

import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * 后台路由级错误边界。
 *
 * 之前后台没有 error.tsx，DB 查询失败或页面渲染异常时直接落到 Next 的默认错误页，
 * 既没有中文说明也没有回后台的入口。这里提供「重试 / 返回后台首页」两条退路。
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  React.useEffect(() => {
    // 前台已经看不到堆栈了，至少把原始错误留在浏览器控制台方便排查
    console.error("[admin] 页面渲染失败：", error);
  }, [error]);

  return (
    <div className="surface flex min-h-[clamp(320px,50vh,520px)] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold tracking-tight">{t("admin.errorTitle")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("admin.errorHint")}</p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          {t("admin.errorDigest", { digest: error.digest })}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" className="press" onClick={reset}>
          <RotateCcwIcon className="size-4" />
          {t("admin.errorRetry")}
        </Button>
        <Button asChild variant="outline" className="press">
          <NextLink href="/admin">
            <ArrowLeftIcon className="size-4" />
            {t("admin.errorBack")}
          </NextLink>
        </Button>
      </div>
    </div>
  );
}
