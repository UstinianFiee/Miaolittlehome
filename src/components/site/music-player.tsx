"use client";

import {
  ListMusicIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  Repeat1Icon,
  RepeatIcon,

  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaylistTrack } from "@/lib/playlist";

/**
 * 全局音乐播放器（docs/SPEC.md 阶段 12）。
 *
 * 「不中断」的关键：组件挂在站点语言布局里，路由切换时布局不会重新挂载，
 * 因此 <audio> 元素与播放状态都得以保留。
 * 注意：import type 引入 PlaylistTrack，避免把服务端的 prisma 带进客户端包。
 */

type RepeatMode = "off" | "all" | "one";

const STORAGE_KEY = "music-player-state";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function MusicPlayer({ tracks }: { tracks: PlaylistTrack[] }) {
  const t = useTranslations();

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = React.useRef(false);

  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.8);
  const [muted, setMuted] = React.useState(false);
  const [repeat, setRepeat] = React.useState<RepeatMode>("all");
  const [expanded, setExpanded] = React.useState(false);
  const [showList, setShowList] = React.useState(false);
  const [restored, setRestored] = React.useState(false);

  const current = tracks[index] ?? null;

  // 恢复上次的音量/曲目/循环模式
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          index: number;
          volume: number;
          repeat: RepeatMode;
        }>;

        if (typeof saved.index === "number" && saved.index >= 0 && saved.index < tracks.length) {
          setIndex(saved.index);
        }
        if (typeof saved.volume === "number") {
          setVolume(Math.min(1, Math.max(0, saved.volume)));
        }
        if (saved.repeat === "off" || saved.repeat === "all" || saved.repeat === "one") {
          setRepeat(saved.repeat);
        }
      }
    } catch {
      // 忽略损坏的本地状态
    }
    setRestored(true);
  }, [tracks.length]);

  React.useEffect(() => {
    if (!restored) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ index, volume, repeat }));
    } catch {
      // 忽略写入失败
    }
  }, [restored, index, volume, repeat]);

  // 音量/静音同步到 audio 元素
  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
    }
  }, [volume, muted, index]);

  // 切换曲目后按需自动播放
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.load();
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      void audio.play().catch(() => setPlaying(false));
    }
  }, [index]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      pendingPlayRef.current = true;
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }

  function selectTrack(next: number) {
    if (tracks.length === 0) {
      return;
    }
    const normalized = ((next % tracks.length) + tracks.length) % tracks.length;
    pendingPlayRef.current = true;
    setIndex(normalized);
  }

  function handleEnded() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (repeat === "one") {
      audio.currentTime = 0;
      void audio.play().catch(() => setPlaying(false));
      return;
    }

    if (repeat === "off" && index === tracks.length - 1) {
      setPlaying(false);
      return;
    }

    selectTrack(index + 1);
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    const value = Number(event.target.value);
    if (audio) {
      audio.currentTime = value;
    }
    setCurrentTime(value);
  }

  function cycleRepeat() {
    setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }

  if (tracks.length === 0 || !current) {
    return null;
  }

  const repeatLabel =
    repeat === "one" ? t("player.repeatOne") : repeat === "all" ? t("player.repeatAll") : t("player.repeatOff");

  return (
    <>
      <audio
        ref={audioRef}
        src={current.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          event.currentTarget.volume = volume;
          event.currentTarget.muted = muted;
        }}
        onEnded={handleEnded}
      />

      <div
        data-testid="music-player"
        className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-2 sm:right-5 sm:bottom-5"
      >
        {expanded && showList ? (
          <div className="max-h-72 w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border/60 bg-background/95 p-2 shadow-lg backdrop-blur">
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {t("player.trackCount", { count: tracks.length })}
            </p>
            <ul>
              {tracks.map((track, position) => (
                <li key={`${track.id}-${position}`}>
                  <button
                    type="button"
                    onClick={() => selectTrack(position)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      position === index && "text-primary"
                    )}
                  >
                    <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {position + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{track.title}</span>
                    {track.artist ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{track.artist}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-lg border border-border/60 bg-background/95 shadow-lg backdrop-blur",
            expanded ? "w-[min(20rem,calc(100vw-1.5rem))] p-3" : "p-1.5"
          )}
        >
          {expanded ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                {current.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.cover}
                    alt=""
                    className="size-12 shrink-0 rounded border border-border/60 object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded border border-border/60 bg-muted/40">
                    <MusicIcon className="size-5 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={current.title}>
                    {current.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {current.artist || t("player.nowPlaying")}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("player.close")}
                  onClick={() => {
                    setExpanded(false);
                    setShowList(false);
                  }}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>

              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0)}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={handleSeek}
                  aria-label={t("player.progress")}
                  data-testid="player-progress"
                  className="h-1.5 w-full cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={repeatLabel}
                  title={repeatLabel}
                  onClick={cycleRepeat}
                  className={cn(repeat !== "off" && "text-primary")}
                >
                  {repeat === "one" ? <Repeat1Icon className="size-4" /> : <RepeatIcon className="size-4" />}
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("player.prev")}
                    disabled={tracks.length < 2}
                    onClick={() => selectTrack(index - 1)}
                  >
                    <SkipBackIcon className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    size="icon-sm"
                    aria-label={playing ? t("player.pause") : t("player.play")}
                    onClick={togglePlay}
                  >
                    {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("player.next")}
                    disabled={tracks.length < 2}
                    onClick={() => selectTrack(index + 1)}
                  >
                    <SkipForwardIcon className="size-4" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("player.playlist")}
                  onClick={() => setShowList((value) => !value)}
                  className={cn(showList && "text-primary")}
                >
                  <ListMusicIcon className="size-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={muted ? t("player.unmute") : t("player.mute")}
                  onClick={() => setMuted((value) => !value)}
                >
                  {muted || volume === 0 ? (
                    <VolumeXIcon className="size-4" />
                  ) : (
                    <Volume2Icon className="size-4" />
                  )}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(event) => {
                    setVolume(Number(event.target.value));
                    setMuted(false);
                  }}
                  aria-label={t("player.volume")}
                  data-testid="player-volume"
                  className="h-1.5 flex-1 cursor-pointer accent-primary"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                aria-label={playing ? t("player.pause") : t("player.play")}
                onClick={togglePlay}
              >
                {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("player.open")}
                onClick={() => setExpanded(true)}
              >
                <MusicIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
