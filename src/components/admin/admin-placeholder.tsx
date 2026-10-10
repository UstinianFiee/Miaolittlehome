"use client";

import { useTranslations } from "next-intl";

type AdminPlaceholderProps = {
  /** 模块标题的文案 key，例如 "admin.nav.posts" */
  titleKey: string;
  /** 计划实现该模块的阶段编号 */
  stage: number;
  /** 该阶段将实现的内容，对应 messages 中 placeholder.scope.<key> */
  scopeKey: string;
};

/** 后台未实现模块的占位：标题取模块名，下方说明计划阶段。 */
export function AdminPlaceholder({ titleKey, stage, scopeKey }: AdminPlaceholderProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h1>
      <div className="rounded-lg border border-dashed border-border/70 bg-background p-6">
        <p className="text-sm text-muted-foreground">
          {t("placeholder.notice", { stage, scope: t(`placeholder.scope.${scopeKey}`) })}
        </p>
      </div>
    </div>
  );
}
