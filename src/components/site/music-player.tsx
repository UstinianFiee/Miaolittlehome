"use client";

import {
  ListMusicIcon, MusicIcon, PauseIcon, PlayIcon,
  Repeat1Icon, RepeatIcon, ShuffleIcon, SkipBackIcon, SkipForwardIcon,
  Volume2Icon, VolumeXIcon, XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { createPortal } from "react-dom";

import type { PlaylistTrack } from "@/lib/playlist";
import { resizedImageUrl } from "@/lib/image-url";
import { MusicSpectrum } from "./music-spectrum";
import { useMusicAudio } from "./use-music-audio";
import { usePlayerPosition } from "./use-player-position";
import styles from "./music-player.module.css";

function formatTime(seconds: number) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = React.useState<string | null>(null);
  // 展示位最大 54px（面板缩略图 44px），用 128 档即可，不必拉上传原图
  const resolved = src ? resizedImageUrl(src, 128) : null;
  return (
    <span className={styles.artwork} aria-hidden="true">
      <span className={styles.artworkFallback}><MusicIcon /></span>
      {resolved && failed !== resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={resolved} src={resolved} alt="" draggable={false} decoding="async"
          onError={() => setFailed(resolved)}
          ref={(image) => { if (image?.complete && !image.naturalWidth) setFailed(resolved); }} />
      ) : null}
    </span>
  );
}

/** 仍由语言布局中的懒加载壳持有；Portal 只移动 UI，不创建第二个播放器。 */
export function MusicPlayer({ tracks }: { tracks: PlaylistTrack[] }) {
  const t = useTranslations("player");
  const player = useMusicAudio(tracks);
  const current = tracks[player.index] ?? null;
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [showList, setShowList] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();
  const listId = React.useId();
  const hintId = React.useId();
  const statusId = React.useId();
  const status = player.error ? t(player.error) : player.waiting ? t("loading") : player.notice ? t(player.notice) : "";
  const { rootRef, panelRef, statusRef, safeAreaRef, dragging, dragHandlers } = usePlayerPosition(Boolean(current && portalTarget), expanded, Boolean(!expanded && status));

  React.useEffect(() => { setPortalTarget(document.body); }, []);

  const closePanel = React.useCallback(() => {
    setExpanded(false);
    setShowList(false);
  }, []);

  React.useEffect(() => {
    if (!expanded) return;
    closeRef.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        closePanel();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closePanel(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded, closePanel, rootRef, panelRef]);

  if (!current || !portalTarget) return null;

  const repeatLabel = t(player.repeat === "one" ? "repeatOne" : player.repeat === "all" ? "repeatAll" : "repeatOff");
  const playLabel = t(player.requested ? "pause" : "play");
  const PlayPause = player.requested ? PauseIcon : PlayIcon;

  return createPortal(
    <div ref={rootRef} data-testid="music-player" className={styles.player}
      data-dragging={dragging} data-playing={player.playing} {...dragHandlers}>
      <span ref={safeAreaRef} className={styles.safeArea} aria-hidden="true" />
      <span id={hintId} className={styles.srOnly}>{t("dragHint")}</span>
      <div className={styles.orb} data-player-drag=""
        onClick={(event) => {
          if (dragging) return;
          // 点星环外圈 = 展开/收起面板；点封面（播放/暂停）和拖动把手不触发。
          // glass 与 spectrum 都是 pointer-events:none，所以点中心区域时 target 就是 orb 本身。
          if (event.target === event.currentTarget) {
            if (expanded) closePanel();
            else setExpanded(true);
          }
        }}>
        <div className={styles.glass} aria-hidden="true" />
        <MusicSpectrum analyser={player.analyser} playing={player.playing} className={styles.spectrum} />
        <button type="button" className={styles.coverButton} data-player-drag=""
          aria-label={`${playLabel} · ${current.title}`} aria-describedby={hintId}
          title={`${current.title}${current.artist ? ` · ${current.artist}` : ""} · ${t("dragHint")}`}
          data-testid="player-orb-play"
          onClick={player.toggle}
          onDoubleClick={() => setExpanded(true)}>
          <Cover src={current.cover} />
          {/* 播放中不显示图标（音乐在响，图标反而遮住封面）；暂停时才给一个轻提示 */}
          {player.playing ? null : (
            <span className={styles.playGlyph}><PlayPause aria-hidden="true" /></span>
          )}
        </button>
      </div>

      <div ref={statusRef} id={statusId} role="status" aria-live="polite" aria-atomic="true"
        className={!expanded && status ? styles.bubble : styles.srOnly} data-error={Boolean(player.error)}>
        {status}
      </div>

      {expanded ? (
        <section ref={panelRef} id={panelId} role="dialog" aria-modal="false"
          aria-label={t("title")} className={styles.panel} data-testid="player-panel">
          <div className={styles.heading}>
            <div className={styles.thumbnail}><Cover src={current.cover} /></div>
            <div className={styles.trackInfo}>
              <p className={styles.eyebrow}>{t("nowPlaying")}</p>
              <p className={styles.title} title={current.title}>{current.title}</p>
              {current.artist ? <p className={styles.artist} title={current.artist}>{current.artist}</p> : null}
            </div>
            <button ref={closeRef} type="button" className={styles.iconButton} aria-label={t("close")}
              onClick={() => closePanel()}><XIcon aria-hidden="true" /></button>
          </div>

          {status ? <p className={styles.notice} data-error={Boolean(player.error)}>{status}</p> : null}

          <div className={styles.progress}>
            <input type="range" min={0} max={Math.max(0, player.duration)} step={0.1}
              value={Math.min(player.currentTime, player.duration || 0)} disabled={player.duration <= 0}
              onChange={(event) => player.seek(Number(event.target.value))}
              aria-label={t("progress")} aria-valuetext={`${formatTime(player.currentTime)} / ${formatTime(player.duration)}`}
              data-testid="player-progress" />
            <div className={styles.times}><span>{formatTime(player.currentTime)}</span><span>{formatTime(player.duration)}</span></div>
          </div>

          <div className={styles.transport}>
            <button type="button" className={styles.iconButton} aria-label={repeatLabel} title={repeatLabel}
              data-active={player.repeat !== "off"} onClick={player.cycleRepeat}>
              {player.repeat === "one" ? <Repeat1Icon aria-hidden="true" /> : <RepeatIcon aria-hidden="true" />}
            </button>
            <button type="button" className={styles.iconButton} aria-label={t("prev")}
              disabled={tracks.length < 2} onClick={player.previous}><SkipBackIcon aria-hidden="true" /></button>
            <button type="button" className={styles.transportPlay} aria-label={playLabel}
              onClick={player.toggle}><PlayPause aria-hidden="true" /></button>
            <button type="button" className={styles.iconButton} aria-label={t("next")}
              disabled={tracks.length < 2} onClick={player.next}><SkipForwardIcon aria-hidden="true" /></button>
            <button type="button" className={styles.iconButton} aria-label={t("shuffle")}
              title={t(player.shuffle ? "shuffleOn" : "shuffleOff")}
              aria-pressed={player.shuffle} data-active={player.shuffle}
              disabled={tracks.length < 2} onClick={player.toggleShuffle}><ShuffleIcon aria-hidden="true" /></button>
            <button type="button" className={styles.iconButton} aria-label={t("playlist")} aria-controls={listId}
              aria-expanded={showList} data-active={showList} onClick={() => setShowList((value) => !value)}>
              <ListMusicIcon aria-hidden="true" />
            </button>
          </div>

          <div className={styles.volume}>
            <button type="button" className={styles.iconButton} aria-label={t(player.muted ? "unmute" : "mute")}
              aria-pressed={player.muted} onClick={player.toggleMute}>
              {player.muted || player.volume === 0 ? <VolumeXIcon aria-hidden="true" /> : <Volume2Icon aria-hidden="true" />}
            </button>
            <input type="range" min={0} max={1} step={0.01} value={player.muted ? 0 : player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              aria-label={t("volume")} aria-valuetext={`${Math.round((player.muted ? 0 : player.volume) * 100)}%`} data-testid="player-volume" />
            <span className={styles.volumeValue} aria-hidden="true">{Math.round((player.muted ? 0 : player.volume) * 100)}%</span>
          </div>

          <div id={listId} hidden={!showList} className={styles.playlist}>
            <p className={styles.listHeading}>{t("trackCount", { count: tracks.length })}</p>
            <ul aria-label={t("playlist")}>
              {tracks.map((track, position) => (
                <li key={`${track.id}-${position}`}>
                  <button type="button" onClick={() => player.select(position)}
                    className={styles.track} aria-current={position === player.index ? "true" : undefined}>
                    <span className={styles.trackNumber} aria-hidden="true">{position + 1}</span>
                    <span className={styles.listTrackInfo}>
                      <span>{track.title}</span>
                      {track.artist ? <small>{track.artist}</small> : null}
                    </span>
                    {position === player.index ? <MusicIcon aria-hidden="true" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>, portalTarget
  );
}
