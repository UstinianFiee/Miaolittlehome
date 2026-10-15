"use client";

import { RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { SuccessNote } from "@/components/admin/success-note";
import { DualTime } from "@/components/site/dual-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OperationItem = {
  id: number;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
};

type VisitItem = {
  id: number;
  path: string;
  ipRegion: string | null;
  ua: string | null;
  referer: string | null;
  createdAt: string;
};

type LogStats = {
  operations: number;
  visits: number;
  retentionDays: number;
  topPaths: { path: string; count: number }[];
  topRegions: { region: string; count: number }[];
};

type LogData = {
  type: "operation" | "visit";
  total: number;
  page: number;
  pageCount: number;
  stats: LogStats;
  actions: { action: string; count: number }[];
  items: OperationItem[] | VisitItem[];
};

const ALL_ACTIONS = "all";

export function LogViewer() {
  const t = useTranslations();

  const [type, setType] = React.useState<"operation" | "visit">("operation");
  const [page, setPage] = React.useState(1);
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [action, setAction] = React.useState(ALL_ACTIONS);

  const [data, setData] = React.useState<LogData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ type, page: String(page) });
      if (keyword) {
        params.set("q", keyword);
      }
      if (type === "operation" && action !== ALL_ACTIONS) {
        params.set("action", action);
      }

      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; data?: LogData; error?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        setError(payload?.error ?? "");
        return;
      }

      setData(payload.data);
    } catch {
      setError("");
    } finally {
      setLoading(false);
    }
  }, [type, page, keyword, action]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function cleanup() {
    if (!data) {
      return;
    }
    if (!window.confirm(t("adminLogs.cleanupConfirm", { days: data.stats.retentionDays }))) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/logs/cleanup", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; data?: { operations: number; visits: number }; error?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        setError(t("adminLogs.cleanupFailed", { message: payload?.error ?? "" }));
        return;
      }

      setMessage(
        t("adminLogs.cleanupDone", {
          operations: payload.data.operations,
          visits: payload.data.visits,
        })
      );
      setPage(1);
      await load();
    } catch {
      setError(t("adminLogs.cleanupFailed", { message: "" }));
    }
  }

  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("adminLogs.title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("adminLogs.refresh")}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCwIcon className="size-4" />
            {t("adminLogs.refresh")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void cleanup()} data-testid="log-cleanup">
            <Trash2Icon className="trash-wiggle size-4" />
            {t("adminLogs.cleanup")}
          </Button>
        </div>
      </div>

      {/* 概览 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-3">
          <p className="text-xs text-muted-foreground">{t("adminLogs.totalOperations")}</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="stat-operations">
            {stats?.operations ?? "—"}
          </p>
        </div>
        <div className="surface p-3">
          <p className="text-xs text-muted-foreground">{t("adminLogs.totalVisits")}</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="stat-visits">
            {stats?.visits ?? "—"}
          </p>
        </div>
        <div className="surface p-3">
          <p className="text-xs text-muted-foreground">{t("adminLogs.retention", { days: stats?.retentionDays ?? 7 })}</p>
          <p className="text-xs text-muted-foreground">{t("adminLogs.cleanupHint")}</p>
        </div>
        <div className="surface p-3">
          <p className="text-xs text-muted-foreground">{t("adminLogs.topRegions")}</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {(stats?.topRegions ?? []).slice(0, 3).map((row) => (
              <li key={row.region} className="flex justify-between gap-2">
                <span className="truncate">{row.region}</span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </li>
            ))}
            {(stats?.topRegions ?? []).length === 0 ? (
              <li className="text-muted-foreground">{t("adminLogs.noStats")}</li>
            ) : null}
          </ul>
        </div>
      </div>

      {stats && stats.topPaths.length > 0 ? (
        <div className="surface p-3">
          <p className="text-xs text-muted-foreground">{t("adminLogs.topPaths")}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {stats.topPaths.map((row) => (
              <li key={row.path}>
                <Badge variant="secondary">
                  {row.path} · {row.count}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 切换与筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={type === "operation" ? "default" : "outline"}
          size="sm"
          data-testid="tab-operations"
          onClick={() => {
            setType("operation");
            setPage(1);
          }}
        >
          {t("adminLogs.tabOperations")}
        </Button>
        <Button
          type="button"
          variant={type === "visit" ? "default" : "outline"}
          size="sm"
          data-testid="tab-visits"
          onClick={() => {
            setType("visit");
            setPage(1);
          }}
        >
          {t("adminLogs.tabVisits")}
        </Button>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setKeyword(keywordInput.trim());
            setPage(1);
          }}
        >
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={t("adminLogs.searchPlaceholder")}
              className="w-56 pl-8"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            {t("posts.search")}
          </Button>
        </form>

        {type === "operation" && data && data.actions.length > 0 ? (
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label={t("adminLogs.filterAction")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACTIONS}>{t("adminLogs.allActions")}</SelectItem>
              {data.actions.map((row) => (
                <SelectItem key={row.action} value={row.action}>
                  {row.action}（{row.count}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {message ? (
        <SuccessNote>{message}</SuccessNote>
      ) : null}

      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {t("adminLogs.cleanupFailed", { message: error })}
        </p>
      ) : null}

      {/* 列表 */}
      <div className="surface">
        <Table>
          <TableHeader>
            {type === "operation" ? (
              <TableRow>
                <TableHead className="w-48">{t("adminLogs.colAction")}</TableHead>
                <TableHead className="w-48">{t("adminLogs.colTarget")}</TableHead>
                <TableHead>{t("adminLogs.colDetail")}</TableHead>
                <TableHead className="w-56">{t("adminLogs.colTime")}</TableHead>
              </TableRow>
            ) : (
              <TableRow>
                <TableHead className="w-64">{t("adminLogs.colPath")}</TableHead>
                <TableHead className="w-40">{t("adminLogs.colRegion")}</TableHead>
                <TableHead>{t("adminLogs.colUa")}</TableHead>
                <TableHead className="w-56">{t("adminLogs.colTime")}</TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="empty-state py-10 text-center text-muted-foreground">
                  {t("adminLogs.empty")}
                </TableCell>
              </TableRow>
            ) : type === "operation" ? (
              (data?.items as OperationItem[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="secondary">{item.action}</Badge>
                  </TableCell>
                  <TableCell className="max-w-0 truncate text-sm">{item.target ?? "—"}</TableCell>
                  <TableCell className="max-w-0 truncate text-sm text-muted-foreground">
                    {item.detail ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <DualTime date={item.createdAt} variant="stacked" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              (data?.items as VisitItem[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-0 truncate text-sm">{item.path}</TableCell>
                  <TableCell className="text-sm">{item.ipRegion || "—"}</TableCell>
                  <TableCell className="max-w-0 truncate text-xs text-muted-foreground">
                    {item.ua ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <DualTime date={item.createdAt} variant="stacked" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("site.pageInfo", { page: data.page, totalPages: data.pageCount })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {t("site.prevPage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page >= data.pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("site.nextPage")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
