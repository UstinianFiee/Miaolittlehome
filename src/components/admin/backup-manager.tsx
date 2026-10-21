"use client";

import { AlertTriangleIcon, DownloadIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uploadFileInChunks } from "@/lib/client-upload";
import { formatDual } from "@/lib/datetime";
import { formatBytes } from "@/lib/format";

export type BackupCountsView = {
  posts: number;
  shuoshuo: number;
  comments: number;
  categories: number;
  tags: number;
  albums: number;
  media: number;
  videos: number;
  software: number;
  announcements: number;
  friends: number;
};

export type BackupStatsView = {
  counts: BackupCountsView;
  media: { files: number; bytes: number };
  software: { files: number; bytes: number };
};

export type BackupImportResult = {
  counts: BackupCountsView;
  files: { written: number };
  snapshot: { fileName: string; bytes: number } | null;
  source: { siteName: string; exportedAt: string };
};

/** 与后端 `BACKUP_MAX_SIZE` 保持一致 */
const MAX_BYTES = 4 * 1024 * 1024 * 1024 - 1;

/** 页面上展示的统计项（顺序即显示顺序） */
const COUNT_ROWS: { key: keyof BackupCountsView; labelKey: string }[] = [
  { key: "posts", labelKey: "statPosts" },
  { key: "shuoshuo", labelKey: "statShuoshuo" },
  { key: "comments", labelKey: "statComments" },
  { key: "categories", labelKey: "statCategories" },
  { key: "tags", labelKey: "statTags" },
  { key: "albums", labelKey: "statAlbums" },
  { key: "media", labelKey: "statMedia" },
  { key: "videos", labelKey: "statVideos" },
  { key: "software", labelKey: "statSoftware" },
  { key: "announcements", labelKey: "statAnnouncements" },
  { key: "friends", labelKey: "statFriends" },
];

/**
 * 内容导出 / 导入。
 *
 * 导出走浏览器原生下载（服务端流式输出，不在内存里攒整包，浏览器自带进度条）；
 * 导入走分片上传，因为备份包可能几百 MB，一次性 POST 失败就得从头再来。
 */
export function BackupManager({ stats }: { stats: BackupStatsView }) {
  const t = useTranslations();
  const router = useRouter();

  const [includeMedia, setIncludeMedia] = React.useState(true);
  const [includeSoftware, setIncludeSoftware] = React.useState(false);

  const [file, setFile] = React.useState<File | null>(null);
  const [percent, setPercent] = React.useState(0);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<BackupImportResult | null>(null);

  const estimatedBytes =
    (includeMedia ? stats.media.bytes : 0) + (includeSoftware ? stats.software.bytes : 0);
  const overLimit = estimatedBytes > MAX_BYTES;

  function download() {
    const url = `/api/admin/backup/export?media=${includeMedia ? 1 : 0}&software=${includeSoftware ? 1 : 0}`;
    // 用原生导航而不是 fetch：这样是「下载」而不是把几百 MB 读进 JS 内存
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || importing) {
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);
    setPercent(0);

    try {
      const outcome = await uploadFileInChunks(
        file,
        {
          init: "/api/admin/backup/upload/init",
          chunk: "/api/admin/backup/upload/chunk",
          complete: "/api/admin/backup/upload/complete",
        },
        {},
        setPercent
      );

      if (!outcome.ok) {
        setError(t("adminBackup.failed", { message: outcome.message }));
        return;
      }

      setResult(outcome.data as BackupImportResult);
      setFile(null);
      setPercent(100);
      // 页面上的统计是服务端渲染的，导入后要重新取一次
      router.refresh();
    } catch (error) {
      // uploadFileInChunks 已兜底；这里保证导入状态一定复位
      setError(
        t("adminBackup.failed", {
          message: error instanceof Error ? error.message : "",
        })
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("adminBackup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminBackup.subtitle")}</p>
      </div>

      {/* ---------- 当前内容 ---------- */}
      <div className="surface p-4">
        <h2 className="text-sm font-medium">{t("adminBackup.statsTitle")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {COUNT_ROWS.map((row) => (
            <div key={row.key} className="rounded-md border border-border/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t(`adminBackup.${row.labelKey}`)}</p>
              <p className="text-lg tabular-nums">{stats.counts[row.key]}</p>
            </div>
          ))}
          <div className="rounded-md border border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("adminBackup.statFiles")}</p>
            <p className="text-lg tabular-nums">
              {stats.media.files + stats.software.files}
            </p>
          </div>
        </div>
      </div>

      {/* ---------- 导出 ---------- */}
      <div className="surface space-y-3 p-4">
        <div>
          <h2 className="text-sm font-medium">{t("adminBackup.exportTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("adminBackup.exportHint")}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              id="backup-media"
              checked={includeMedia}
              onCheckedChange={setIncludeMedia}
              disabled={importing}
            />
            <div className="min-w-0">
              <Label htmlFor="backup-media" className="cursor-pointer">
                {t("adminBackup.includeMedia")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("adminBackup.includeMediaHint", {
                  count: stats.media.files,
                  size: formatBytes(stats.media.bytes),
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="backup-software"
              checked={includeSoftware}
              onCheckedChange={setIncludeSoftware}
              disabled={importing}
            />
            <div className="min-w-0">
              <Label htmlFor="backup-software" className="cursor-pointer">
                {t("adminBackup.includeSoftware")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("adminBackup.includeSoftwareHint", {
                  count: stats.software.files,
                  size: formatBytes(stats.software.bytes),
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
          <Button type="button" onClick={download} disabled={overLimit || importing}>
            <DownloadIcon className="size-4" />
            {t("adminBackup.exportButton")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("adminBackup.estimate", { size: formatBytes(estimatedBytes) })}
          </span>
          {overLimit ? (
            <span className="text-xs text-destructive">{t("adminBackup.exportTooLarge")}</span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{t("adminBackup.excluded")}</p>
      </div>

      {/* ---------- 导入 ---------- */}
      <div className="surface space-y-3 p-4">
        <div>
          <h2 className="text-sm font-medium">{t("adminBackup.importTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("adminBackup.importHint")}</p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{t("adminBackup.importWarning")}</p>
        </div>

        <form onSubmit={submitImport} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="backup-file">{t("adminBackup.chooseFile")}</Label>
            <input
              id="backup-file"
              type="file"
              accept=".zip,application/zip"
              disabled={importing}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
              className="block w-full cursor-pointer rounded-md border border-border/60 bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
            />
            {file ? (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatBytes(file.size)}
              </p>
            ) : null}
          </div>

          {importing ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {percent < 100
                  ? t("adminBackup.uploading", { percent })
                  : t("adminBackup.restoring")}
              </p>
            </div>
          ) : null}

          <Button type="submit" variant="destructive" disabled={!file || importing}>
            <UploadIcon className="size-4" />
            {importing ? t("adminBackup.importing") : t("adminBackup.importButton")}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
            <p className="text-sm font-medium text-primary">{t("adminBackup.resultTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("adminBackup.resultSource", {
                site: result.source.siteName || "—",
                time: result.source.exportedAt
                  ? formatDual(new Date(result.source.exportedAt))
                  : "—",
              })}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {COUNT_ROWS.map((row) => (
                <div key={row.key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t(`adminBackup.${row.labelKey}`)}</span>
                  <span className="tabular-nums">{result.counts[row.key]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("adminBackup.resultFiles", { count: result.files.written })}
            </p>
            {result.snapshot ? (
              <p className="text-xs text-muted-foreground">
                {t("adminBackup.resultSnapshot", {
                  file: result.snapshot.fileName,
                  size: formatBytes(result.snapshot.bytes),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
