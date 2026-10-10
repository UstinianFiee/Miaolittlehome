"use client";

import { useTranslations } from "next-intl";

export type DashboardStat = {
  labelKey: string;
  value: number;
  /** 可选的补充说明，例如「待审核 N」 */
  hintKey?: string;
  hintValue?: number;
};

export type DashboardOperation = {
  id: number;
  action: string;
  target: string | null;
  createdAt: string;
};

/** 后台仪表盘：统计卡片 + 最近操作。数据由服务端查询后传入。 */
export function AdminDashboard({
  stats,
  operations,
}: {
  stats: readonly DashboardStat[];
  operations: readonly DashboardOperation[];
}) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl">{t("admin.nav.dashboard")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.labelKey}
            className="surface p-4"
          >
            <p className="text-sm text-muted-foreground">{t(stat.labelKey)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
            {stat.hintKey !== undefined && stat.hintValue !== undefined ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t(stat.hintKey)} {stat.hintValue}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <section className="surface overflow-hidden">
        <h2 className="border-b border-border/60 px-4 py-3 text-sm font-medium">
          {t("admin.dashboard.recentOperations")}
        </h2>
        {operations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {t("admin.dashboard.noOperations")}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {operations.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span>
                  {t(`admin.action.${item.action}`)}
                  {item.target ? (
                    <span className="ml-2 text-muted-foreground">{item.target}</span>
                  ) : null}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {item.createdAt}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
