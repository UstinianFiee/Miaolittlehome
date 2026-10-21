"use client";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  FileAudioIcon,
  FilmIcon,
  ImageIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { FileUploader } from "@/components/admin/file-uploader";
import { DualTime } from "@/components/site/dual-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
/** 每页卡片数：只渲染当前页，避免一次挂载几百个 Radix Select + 视频缩略图。 */
const PAGE_SIZE = 24;

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
        aria-label={t("media.setTitle")}
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
  items: initialItems,
  type,
  initialAlbum = "all",
  albums,
}: {
  items: MediaItem[];
  type: string;
  initialAlbum?: string;
  albums: { id: number; name: string }[];
}) {
  const t = useTranslations();

  const [list, setList] = React.useState<MediaItem[]>(initialItems);
  const [activeType, setActiveType] = React.useState(type);
  const [albumFilter, setAlbumFilter] = React.useState(initialAlbum);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [isPending, startTransition] = React.useTransition();
  const deferredQuery = React.useDeferredValue(query);

  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [thumbPendingId, setThumbPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /** 上传/补封面后拉一次最新元数据；不在每次改名、改相册、删除时整页刷新。 */
  async function reloadItems() {
    try {
      const response = await fetch("/api/admin/media?limit=500", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as {
        data?: { items?: MediaItem[] };
      } | null;
      if (payload?.data?.items) {
        setList(payload.data.items);
      }
    } catch {
      // 静默失败；列表仍保留旧数据，可手动刷新
    }
  }

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    all: t("media.filterAll"),
    image: t("media.filterImage"),
    audio: t("media.filterAudio"),
    video: t("media.filterVideo"),
  };

  const filtered = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return list.filter((item) => {
      if (activeType !== "all" && item.type !== activeType) {
        return false;
      }
      if (albumFilter !== "all" && String(item.albumId ?? "") !== albumFilter) {
        return false;
      }
      if (needle) {
        const title = (item.title ?? "").toLowerCase();
        if (!title.includes(needle) && !item.path.toLowerCase().includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [list, activeType, albumFilter, deferredQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 筛选/搜索变化时回到第一页
  React.useEffect(() => {
    setPage(1);
  }, [activeType, albumFilter, query]);

  /*
   * 用 history.replaceState 同步查询串，不触发 Next 路由。
   * 之前这里用 router.push，每次切换都会重新请求 RSC 并重挂载所有卡片。
   */
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (activeType !== "all") {
      params.set("type", activeType);
    }
    if (albumFilter !== "all") {
      params.set("album", albumFilter);
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const suffix = params.toString();
    window.history.replaceState(
      null,
      "",
      `/admin/media${suffix ? `?${suffix}` : ""}`
    );
  }, [activeType, albumFilter, page, query]);

  async function makeThumb(item: MediaItem) {
    setThumbPendingId(item.id);
    setError(null);
    try {
      const ok = await backfillVideoThumbnail(item.id, item.path);
      if (ok) {
        await reloadItems();
      } else {
        setError(t("media.thumbFailed"));
      }
    } finally {
      setThumbPendingId(null);
    }
  }

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
      // 局部更新，不再整页 refresh
      setList((prev) => prev.filter((row) => row.id !== item.id));
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
      const nextAlbumId = value === NO_ALBUM ? null : Number(value);
      const albumName = albums.find((album) => album.id === nextAlbumId)?.name ?? null;
      setList((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, albumId: nextAlbumId, albumName } : row
        )
      );
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
      setList((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, title } : row))
      );
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
      // HTTP 环境下 Clipboard API 不可用，给中性提示而不是「删除失败」
      setError(t("admin.copyFailed"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("media.title")}</h1>
        <FileUploader
          albumId={albumFilter === "all" ? null : Number(albumFilter)}
          onUploaded={() => void reloadItems()}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((value) => (
          <Button
            key={value}
            variant={activeType === value ? "default" : "outline"}
            size="sm"
            onClick={() =>
              startTransition(() => {
                setActiveType(value);
                // 切换类型时清掉关键词，避免「音频」页看起来是空的（搜索词其实还在）
                setQuery("");
              })
            }
          >
            {filterLabels[value]}
          </Button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("media.searchPlaceholder")}
              aria-label={t("media.searchPlaceholder")}
              className="h-8 w-52 pl-8 text-xs"
            />
          </div>

          <select
            value={albumFilter}
            onChange={(event) => setAlbumFilter(event.target.value)}
            aria-label={t("media.album")}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-card-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="all">{t("media.allAlbums")}</option>
            {albums.map((album) => (
              <option key={album.id} value={String(album.id)}>
                {album.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("media.resultCount", { count: filtered.length })}</span>
        {pageCount > 1 ? (
          <span>{t("site.pageInfo", { page: safePage, totalPages: pageCount })}</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {list.length === 0 ? (
        <p className="empty-state rounded-lg border border-dashed border-border/70 bg-background py-16 text-center text-sm text-muted-foreground">
          {t("media.empty")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty-state rounded-lg border border-dashed border-border/70 bg-background py-16 text-center text-sm text-muted-foreground">
          {t("media.noResults")}
        </p>
      ) : (
        <ul
          className={cn(
            "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
            isPending && "opacity-70"
          )}
        >
          {pageItems.map((item) => (
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
                  // 老视频没有封面时不再自动挂 <video> 抽帧：那会为每张卡发 Range 请求，
                  // 视频一多就把带宽占满、筛选也卡。这里给轻量占位，需要封面就点「生成封面」。
                  item.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumb}
                      alt={item.title ?? ""}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <FilmIcon className="size-6" />
                      <span className="text-[0.65rem]">{t("media.noThumb")}</span>
                    </div>
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

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm text-muted-foreground">
            {t("site.pageInfo", { page: safePage, totalPages: pageCount })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
            >
              <ChevronLeftIcon className="size-4" />
              {t("site.prevPage")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage(Math.min(pageCount, safePage + 1))}
            >
              {t("site.nextPage")}
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
