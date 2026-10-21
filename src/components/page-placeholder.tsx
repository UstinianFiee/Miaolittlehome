"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type PagePlaceholderProps = {
  /** 计划实现该页面的阶段编号（见 docs/SPEC.md 阶段计划） */
  stage: number;
  /** 该阶段将实现的内容，对应 messages 中 placeholder.scope.<key> */
  scopeKey: string;
};

/** 尚未实现的页面占位：保证导航可达、不出现 404，后续阶段直接替换页面内容。 */
export function PagePlaceholder({ stage, scopeKey }: PagePlaceholderProps) {
  const t = useTranslations();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight break-words">{t("placeholder.title")}</h1>
      <p className="break-words text-muted-foreground">
        {t("placeholder.notice", { stage, scope: t(`placeholder.scope.${scopeKey}`) })}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/">
          <ArrowLeftIcon className="size-4" />
          {t("actions.backHome")}
        </Link>
      </Button>
    </div>
  );
}
