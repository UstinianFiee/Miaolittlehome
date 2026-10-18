"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { MediaField, type MediaOption } from "@/components/admin/media-field";
import { SuccessNote } from "@/components/admin/success-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlaylistRow = {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover: string;
};

export type AudioMediaOption = { id: number; path: string; title: string };

const PICK = "none";

export function PlaylistManager({
  initialTracks,
  audioMedia,
  images,
}: {
  initialTracks: PlaylistRow[];
  audioMedia: AudioMediaOption[];
  images: MediaOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [tracks, setTracks] = React.useState<PlaylistRow[]>(initialTracks);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function update(position: number, patch: Partial<PlaylistRow>) {
    setTracks((list) => list.map((track, index) => (index === position ? { ...track, ...patch } : track)));
  }

  function add() {
    setTracks((list) => [
      ...list,
      { id: `track-${Date.now().toString(36)}`, title: "", artist: "", src: "", cover: "" },
    ]);
  }

  function remove(position: number) {
    setTracks((list) => list.filter((_, index) => index !== position));
  }

  function move(position: number, delta: number) {
    setTracks((list) => {
      const target = position + delta;
      if (target < 0 || target >= list.length) {
        return list;
      }
      const next = [...list];
      const [item] = next.splice(position, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  async function save() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/playlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: tracks.map((track, index) => ({
            id: track.id || `track-${index + 1}`,
            title: track.title,
            artist: track.artist,
            src: track.src,
            cover: track.cover || null,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(t("playlistAdmin.failed", { message: payload?.error ?? "" }));
        return;
      }

      setMessage(t("playlistAdmin.saved"));
      router.refresh();
    } catch {
      setError(t("playlistAdmin.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("playlistAdmin.settingsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("playlistAdmin.settingsHint")}</p>
      </div>

      <div className="space-y-3 surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t("playlistAdmin.title")}</h2>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={add} disabled={pending}>
              <PlusIcon className="size-4" />
              {t("playlistAdmin.add")}
            </Button>
            <Button type="button" size="sm" data-testid="playlist-save" onClick={() => void save()} disabled={pending}>
              {pending ? t("playlistAdmin.saving") : t("playlistAdmin.save")}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("playlistAdmin.hint")}</p>

        {tracks.length === 0 ? (
          <p className="empty-state py-8 text-center text-sm text-muted-foreground">{t("playlistAdmin.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {tracks.map((track, position) => (
              <li
                key={`${track.id}-${position}`}
                className="grid gap-3 rounded-md border border-border/60 p-3 lg:grid-cols-[1fr_1fr_1.4fr_1.2fr_auto]"
              >
                <div className="space-y-1">
                  <Label htmlFor={`track-title-${position}`}>{t("playlistAdmin.trackTitle")}</Label>
                  <Input
                    id={`track-title-${position}`}
                    value={track.title}
                    onChange={(event) => update(position, { title: event.target.value })}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`track-artist-${position}`}>{t("playlistAdmin.artist")}</Label>
                  <Input
                    id={`track-artist-${position}`}
                    value={track.artist}
                    onChange={(event) => update(position, { artist: event.target.value })}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`track-src-${position}`}>{t("playlistAdmin.src")}</Label>
                  <Input
                    id={`track-src-${position}`}
                    value={track.src}
                    onChange={(event) => update(position, { src: event.target.value })}
                    maxLength={500}
                    placeholder="/media/…"
                  />
                  {audioMedia.length > 0 ? (
                    <Select
                      value={PICK}
                      onValueChange={(value) => {
                        const picked = audioMedia.find((item) => String(item.id) === value);
                        if (picked) {
                          update(position, {
                            src: picked.path,
                            title: track.title || picked.title,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs" aria-label={t("playlistAdmin.pickFromMedia")}>
                        <SelectValue placeholder={t("playlistAdmin.pickFromMedia")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PICK}>{t("playlistAdmin.pickFromMedia")}</SelectItem>
                        {audioMedia.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("playlistAdmin.noAudio")}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <MediaField
                    id={`track-cover-${position}`}
                    label={t("playlistAdmin.cover")}
                    value={track.cover}
                    onChange={(next) => update(position, { cover: next })}
                    options={images}
                    compact
                  />
                </div>

                <div className="flex items-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("playlistAdmin.moveUp")}
                    disabled={position === 0}
                    onClick={() => move(position, -1)}
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("playlistAdmin.moveDown")}
                    disabled={position === tracks.length - 1}
                    onClick={() => move(position, 1)}
                  >
                    <ArrowDownIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("playlistAdmin.remove")}
                    onClick={() => remove(position)}
                  >
                    <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {message ? (
          <SuccessNote>{message}</SuccessNote>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
