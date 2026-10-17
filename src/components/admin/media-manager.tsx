"use client";

import {
  CheckIcon,
  CopyIcon,
  FileAudioIcon,
  FilmIcon,
  ImageIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { FileUploader } from "@/components/admin/file-uploader";
import { DualTime } from "@/components/site/dual-time";
import { VideoThumb } from "@/components/video-thumb";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { backfillVideoThumbnail } from "@/lib/video-thumb-client";

export type MediaItem = {
  id: number;
  type: string;
  path: string;
  thumb: string | null;
  title: string | null;
  size: string;
  createdAt: string;
  albumId: number | null;
  albumName: string | null;
};

const FILTERS = ["all", "image", "audio", "video"] as const;
const NO_ALBUM = "none";

function formatBytes(raw: string): string {
  const bytes = Number(raw);
  if (!Number.isFinite(bytes)) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "image") {
    return <ImageIcon className="size-4" />;
  }
  if (type === "audio") {
    return <FileAudioIcon className="size-4" />;
  }
  return <FilmIcon className="size-4" />;
}

/**
 * 视频封面：见 `VideoThumb`（单独一个文件，媒体字段的选图弹窗也要用）。
 */

/** 媒体标题：点一下就能改名（后端 PATCH 早就支持 title 了）。 */
function MediaTitle({
  item,
  disabled,
  onRename,
}: {
  item: MediaItem;
  disabled: boolean;
  onRename: (item: MediaItem, title: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(item.title ?? "");

  React.useEffect(() => {
    setValue(item.title ?? "");
  }, [item.title]);

  async function commit() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === item.title) {
      setValue(item.title ?? "");
      return;
    }
    await onRename(item, next);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void commit();
          } else if (event.key === "Escape") {
            setValue(item.title ?? "");
            setEditing(false);
          }
        }}
        className="h-7 w-full min-w-0 rounded border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      title={item.title ?? item.path}
      className="group flex w-full min-w-0 items-center gap-1.5 text-left"
    >
      <span className="truncate text-sm font-medium">{item.title ?? item.path}</span>
      <PencilIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="sr-only">{t("media.setTitle")}</span>
    </button>
  );
}

export function MediaManager({
  items,
  type,
  albums,
}: {
  items: MediaItem[];
  type: string;
  albums: { id: number; name: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [thumbPendingId, setThumbPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * 给已有的视频补一张封面（上传时还没有自动抽帧功能的那些）。
   * 抽帧在浏览器里做，一次只处理一个，不会同时拉很多视频。
   */
  async function makeThumb(item: MediaItem) {
    setThumbPendingId(item.id);
    setError(null);
    try {
      const ok = await backfillVideoThumbnail(item.id, item.path);
      if (ok) {
        router.refresh();
      } else {
        setError(t("media.thumbFailed"));
      }
    } finally {
      setThumbPendingId(null);
    }
  }

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    all: t("media.filterAll"),
    image: t("media.filterImage"),
    audio: t("media.filterAudio"),
    video: t("media.filterVideo"),
  };

  async function remove(item: MediaItem) {
    if (!window.confirm(t("media.deleteConfirm", { name: item.title ?? item.path }))) {
      return;
    }

    setPendingId(item.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("media.deleteFailed", { message: payload?.error ?? "" }));
        return;
      }
      router.refresh();
    } catch {
      setError(t("media.deleteFailed", { message: "" }));
    } finally {
      setPendingId(null);
    }
  }

  async function changeAlbum(item: MediaItem, value: string) {
    setPendingId(item.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: value === NO_ALBUM ? null : Number(value) }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("media.deleteFailed", { message: payload?.error ?? "" }));
        return;
      }
      router.refresh();
    } catch {
      setError(t("media.deleteFailed", { message: "" }));
    } finally {
      setPendingId(null);
    }
  }

  async function rename(item: MediaItem, title: string) {
    setPendingId(item.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("media.renameFailed", { message: payload?.error ?? "" }));
        return;
      }
      router.refresh();
    } catch {
      setError(t("media.renameFailed", { message: "" }));
    } finally {
      setPendingId(null);
    }
  }

  async function copyPath(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(item.path);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError(t("media.deleteFailed", { message: "clipboard" }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("media.title")}</h1>
        <FileUploader onUploaded={() => router.refresh()} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Button
            key={value}
            variant={type === value ? "default" : "outline"}
            size="sm"
            onClick={() =>
              router.push(value === "all" ? "/admin/media" : `/admin/media?type=${value}`)
            }
          >
            {filterLabels[value]}
          </Button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="empty-state rounded-lg border border-dashed border-border/70 bg-background py-16 text-center text-sm text-muted-foreground">
          {t("media.empty")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden surface"
            >
              <div className="flex h-40 items-center justify-center bg-muted/30">
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumb ?? item.path}
                    alt={item.title ?? ""}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : item.type === "video" ? (
                  // 有真封面就显示小图（上传时抽帧生成），只有老视频才回退到 <video> 现抽
                  item.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumb}
                      alt={item.title ?? ""}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <VideoThumb
                      src={item.path}
                      className="h-full w-full object-cover"
                      fallback={<TypeIcon type={item.type} />}
                    />
                  )
                ) : (
                  <TypeIcon type={item.type} />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <MediaTitle
                  item={item}
                  disabled={pendingId === item.id}
                  onRename={rename}
                />
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <TypeIcon type={item.type} />
                  {formatBytes(item.size)}
                  <DualTime date={item.createdAt} className="min-w-0" />
                </p>

                <Select
                  value={item.albumId === null ? NO_ALBUM : String(item.albumId)}
                  onValueChange={(value) => void changeAlbum(item, value)}
                >
                  <SelectTrigger className="h-8 w-full text-xs" aria-label={t("media.album")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ALBUM}>{t("media.noAlbum")}</SelectItem>
                    {albums.map((album) => (
                      <SelectItem key={album.id} value={String(album.id)}>
                        {album.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="mt-auto flex gap-1">
                  {item.type === "video" && !item.thumb ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={thumbPendingId === item.id}
                      onClick={() => void makeThumb(item)}
                    >
                      <ImageIcon className="size-4" />
                      {thumbPendingId === item.id ? t("media.thumbWorking") : t("media.makeThumb")}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("flex-1", copiedId === item.id && "text-primary")}
                    onClick={() => void copyPath(item)}
                  >
                    {copiedId === item.id ? (
                      <CheckIcon className="icon-pop size-4" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                    {copiedId === item.id ? t("media.copied") : t("media.copyPath")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("media.delete")}
                    disabled={pendingId === item.id}
                    onClick={() => void remove(item)}
                  >
                    <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
