"use client";

import * as React from "react";
import type { PlaylistTrack } from "@/lib/playlist";

type RepeatMode = "off" | "all" | "one";
type AudioError = "loadFailed" | "networkError" | "decodeError" | "unsupportedAudio" | "playBlocked" | "seekFailed";
type Notice = "nativePlayback" | "spectrumUnavailable" | null;
type Settings = { index: number; volume: number; muted: boolean; repeat: RepeatMode; shuffle: boolean };
type Playback = Settings & {
  playing: boolean; requested: boolean; waiting: boolean; currentTime: number; duration: number;
  error: AudioError | null; notice: Notice; analyser: AnalyserNode | null;
};
type Controls = {
  toggle: () => void; select: (index: number) => void; seek: (time: number) => void;
  volume: (value: number) => void; mute: () => void; repeat: () => void; reconcile: () => void;
  next: () => void; previous: () => void; shuffle: () => void;
};
const STORAGE_KEY = "music-player-state";
const defaults: Settings = { index: 0, volume: 0.8, muted: false, repeat: "all", shuffle: false };
const initial: Playback = { ...defaults, playing: false, requested: false, waiting: false, currentTime: 0, duration: 0, error: null, notice: null, analyser: null };

/** 每次挂载独占音频元素与 context；路由内重渲染不重建，StrictMode 清理后不复用。 */
export function useMusicAudio(tracks: PlaylistTrack[]) {
  const [state, setState] = React.useState<Playback>(initial);
  const tracksRef = React.useRef(tracks);
  const controls = React.useRef<Controls | null>(null);

  React.useEffect(() => {
    let live = true;
    let settings = { ...defaults };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        if (Number.isInteger(saved.index) && saved.index >= 0 && saved.index < tracksRef.current.length) settings.index = saved.index;
        if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) settings.volume = Math.min(1, Math.max(0, saved.volume));
        if (["off", "all", "one"].includes(saved.repeat)) settings.repeat = saved.repeat;
        if (typeof saved.muted === "boolean") settings.muted = saved.muted;
        if (typeof saved.shuffle === "boolean") settings.shuffle = saved.shuffle;
      }
    } catch { /* 本地存储被禁用或损坏不影响播放。 */ }

    let audio: HTMLAudioElement | null = null;
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let track: PlaylistTrack | null = null;
    let native = false;
    let wantsPlay = false;
    let request = 0;
    let detach = () => {};
    let analysisFailed = false;
    const nativeSources = new Set<string>();
    let remaining: number[] = [];
    let history: number[] = [];
    let forward: number[] = [];
    let playlistSignature = "";
    function resetSequence() {
      remaining = tracksRef.current.map((_, index) => index).filter((index) => index !== settings.index);
      history = [];
      forward = [];
    }
    const patch = (value: Partial<Playback>) => { if (live) setState((old) => ({ ...old, ...value })); };
    const persist = () => {
      patch(settings);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* 隐私模式允许仅在内存保存。 */ }
    };
    const stopAudio = () => {
      request++;
      detach();
      detach = () => {};
      source?.disconnect();
      source = null;
      const old = audio;
      audio = null;
      if (old) { old.pause(); old.removeAttribute("src"); old.load(); }
    };
    const fail = (error: AudioError) => {
      wantsPlay = false;
      audio?.pause();
      patch({ error, playing: false, requested: false, waiting: false });
    };

    function install(next: PlaylistTrack, useNative: boolean, time = 0) {
      stopAudio();
      track = next;
      native = useNative;
      // 不能在已绑定 source 的元素上移除 crossorigin：原生回退必须更换元素。
      const element = new Audio();
      audio = element;
      /*
       * ⚠️ 必须是 "none"，不能是 "metadata"。
       *
       * Chrome 对 `preload="metadata"` 的处理是发 `Range: bytes=0-`；nginx 会老老实实
       * 把**整个文件**发回来。对 MP3 也就几十 KB，但歌单里一旦有无损（FLAC 动辄 30MB+），
       * 首屏就会平白拉走几十 MB —— 实测首页 `load` 事件被拖到 22 秒，占全部流量的 94%。
       * 设成 "none" 后不点播放就完全不联网；真要播时在 `play()` 里改回 "auto"。
       */
      element.preload = "none";
      if (!native) element.crossOrigin = "anonymous";
      element.volume = settings.volume;
      element.muted = settings.muted;
      patch({ currentTime: time, duration: 0, playing: false, requested: wantsPlay, waiting: wantsPlay, error: null, analyser: null, notice: native ? "nativePlayback" : analysisFailed ? "spectrumUnavailable" : null });
      const onMetadata = () => {
        if (audio !== element) return;
        const duration = Number.isFinite(element.duration) ? element.duration : 0;
        if (time > 0 && duration > 0) {
          try { element.currentTime = Math.min(time, Math.max(0, duration - 0.01)); } catch { /* 不可 seek 的流从当前位置继续。 */ }
          time = 0;
        }
        patch({ duration });
      };
      const onTime = () => { if (audio === element) patch({ currentTime: element.currentTime }); };
      const onPlaying = () => {
        if (audio !== element) return;
        if (!wantsPlay) { element.pause(); return; }
        patch({ playing: true, requested: true, waiting: false, error: null });
      };
      const onWaiting = () => { if (audio === element && wantsPlay) patch({ playing: false, waiting: true }); };
      const onPause = () => {
        if (audio !== element) return;
        if (!element.ended) wantsPlay = false;
        patch({ playing: false, requested: wantsPlay, waiting: false });
      };
      const onError = () => { if (audio === element) mediaError(element.error?.code || 4); };
      const onEnded = () => {
        if (audio !== element) return;
        if (settings.repeat === "one") select(settings.index, false);
        else advance(false, true);
      };
      element.addEventListener("loadedmetadata", onMetadata);
      element.addEventListener("durationchange", onMetadata);
      element.addEventListener("timeupdate", onTime);
      element.addEventListener("playing", onPlaying);
      element.addEventListener("waiting", onWaiting);
      element.addEventListener("pause", onPause);
      element.addEventListener("error", onError);
      element.addEventListener("ended", onEnded);
      detach = () => {
        element.removeEventListener("loadedmetadata", onMetadata);
        element.removeEventListener("durationchange", onMetadata);
        element.removeEventListener("timeupdate", onTime);
        element.removeEventListener("playing", onPlaying);
        element.removeEventListener("waiting", onWaiting);
        element.removeEventListener("pause", onPause);
        element.removeEventListener("error", onError);
        element.removeEventListener("ended", onEnded);
      };
      element.src = next.src;
      element.load();
    }

    function mediaError(code: number) {
      // 浏览器不披露 CORS 失败细节。仅网络/来源错误尝试一次原生加载；不以零频谱推断。
      // 同源 URL 也可能重定向到外站，因此按加载失败判断，而非一刀切屏蔽所有外链。
      if (track && !native && !nativeSources.has(track.src) && (code === 2 || code === 4)) {
        nativeSources.add(track.src);
        const time = audio?.currentTime || 0;
        install(track, true, time);
        if (wantsPlay) play(false);
        return;
      }
      fail(code === 2 ? "networkError" : code === 3 ? "decodeError" : code === 4 ? "unsupportedAudio" : "loadFailed");
    }

    function play(gesture: boolean) {
      if (!audio || !track) return;
      wantsPlay = true;
      patch({ requested: true, waiting: true, error: null });
      if (audio.error) install(track, nativeSources.has(track.src), audio.currentTime || 0);
      // 真要点播了才允许联网（默认 preload="none"，见 install() 的注释）
      audio.preload = "auto";
      if (!native && !analysisFailed) {
        try {
          if (context?.state === "closed") {
            context.onstatechange = null;
            context = null;
            analyser = null;
            install(track, false, audio?.currentTime || 0);
          }
          // 仅显式播放/选曲手势创建或恢复 context，自动续播绝不申请解锁。
          if (!context && gesture) {
            const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) throw new Error("AudioContext unavailable");
            context = new AudioContextClass();
            analyser = context.createAnalyser();
            analyser.fftSize = 4096;
            analyser.minDecibels = -85;
            analyser.maxDecibels = -20;
            analyser.smoothingTimeConstant = 0.8;
            analyser.connect(context.destination);
          }
          if (context && analyser && audio) {
            if (!source) {
              source = context.createMediaElementSource(audio);
              source.connect(analyser);
            }
            patch({ analyser });
            if (gesture && context.state !== "running") {
              const activeContext = context;
              const activeAudio = audio;
              void context.resume().catch(() => { if (live && context === activeContext && audio === activeAudio && wantsPlay) fail("playBlocked"); });
            }
          }
        } catch {
          analysisFailed = true;
          // 即使节点已创建后才失败，也不得继续使用被绑定的元素。
          const time = audio?.currentTime || 0;
          nativeSources.add(track.src);
          install(track, true, time);
          patch({ notice: "spectrumUnavailable" });
        }
      }
      const element = audio;
      if (!element) return;
      const token = ++request;
      void element.play().catch((error: unknown) => {
        if (!live || audio !== element || token !== request || !wantsPlay) return;
        const name = error instanceof DOMException || error instanceof Error ? error.name : "";
        if (name === "AbortError") return;
        if (name === "NotSupportedError" || element.error) mediaError(element.error?.code || 4);
        else fail(name === "NotAllowedError" ? "playBlocked" : "loadFailed");
      });
    }

    function select(next: number, gesture: boolean) {
      const list = tracksRef.current;
      if (!list.length) return;
      const normalized = ((next % list.length) + list.length) % list.length;
      const chosen = list[normalized];
      const same = settings.index === normalized && track?.id === chosen.id && track.src === chosen.src;
      settings.index = normalized;
      wantsPlay = true;
      persist();
      if (same && audio && !audio.error) {
        try { audio.currentTime = 0; } catch { install(chosen, nativeSources.has(chosen.src)); }
        patch({ currentTime: 0 });
      } else {
        install(chosen, nativeSources.has(chosen.src));
      }
      play(gesture);
    }

    function advance(gesture: boolean, automatic = false) {
      const count = tracksRef.current.length;
      if (!count) return;
      const stopAtEnd = () => {
        wantsPlay = false;
        audio?.pause();
        patch({ playing: false, requested: false, waiting: false });
      };
      if (!settings.shuffle) {
        if (automatic && settings.repeat === "off" && settings.index === count - 1) stopAtEnd();
        else select(settings.index + 1, gesture);
        return;
      }
      let next = forward.pop();
      if (next === undefined) {
        if (!remaining.length) {
          if (automatic && settings.repeat === "off") { stopAtEnd(); return; }
          remaining = tracksRef.current.map((_, index) => index).filter((index) => index !== settings.index);
        }
        next = remaining.length ? remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0] : settings.index;
      }
      if (next !== settings.index) {
        history.push(settings.index);
        if (history.length > 100) history.shift();
      }
      select(next, gesture);
    }

    const api: Controls = {
      toggle: () => {
        if (wantsPlay) {
          wantsPlay = false;
          request++;
          audio?.pause();
          patch({ playing: false, requested: false, waiting: false });
        } else play(true);
      },
      select: (next) => { select(next, true); resetSequence(); },
      next: () => advance(true),
      previous: () => {
        if (!settings.shuffle) { select(settings.index - 1, true); return; }
        const previous = history.pop();
        if (previous === undefined) { select(settings.index, true); return; }
        forward.push(settings.index);
        select(previous, true);
      },
      shuffle: () => {
        settings.shuffle = !settings.shuffle;
        resetSequence();
        persist();
      },
      seek: (time) => {
        if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(time)) return;
        try {
          audio.currentTime = Math.min(audio.duration, Math.max(0, time));
          patch({ currentTime: audio.currentTime });
        } catch { patch({ error: "seekFailed" }); }
      },
      volume: (value) => {
        settings.volume = Math.min(1, Math.max(0, value));
        settings.muted = false;
        if (audio) { audio.volume = settings.volume; audio.muted = false; }
        persist();
      },
      mute: () => {
        settings.muted = !settings.muted;
        if (audio) audio.muted = settings.muted;
        persist();
      },
      repeat: () => {
        settings.repeat = settings.repeat === "off" ? "all" : settings.repeat === "all" ? "one" : "off";
        persist();
      },
      reconcile: () => {
        const list = tracksRef.current;
        const signature = JSON.stringify(list.map(({ id, src }) => [id, src]));
        const changed = signature !== playlistSignature;
        playlistSignature = signature;
        if (!list.length) {
          resetSequence();
          wantsPlay = false;
          stopAudio();
          track = null;
          settings.index = 0;
          patch({ index: 0, playing: false, requested: false, waiting: false, currentTime: 0, duration: 0, analyser: null });
          return;
        }
        const retained = list.findIndex((item) => item.id === track?.id && item.src === track.src);
        if (retained >= 0) {
          settings.index = retained;
          if (changed) resetSequence();
          persist();
          return;
        }
        settings.index = Math.min(settings.index, list.length - 1);
        resetSequence();
        persist();
        const next = list[settings.index];
        install(next, nativeSources.has(next.src));
        if (wantsPlay) play(false);
      },
    };
    controls.current = api;
    patch({ ...initial, ...settings });
    api.reconcile();
    return () => {
      live = false;
      wantsPlay = false;
      if (controls.current === api) controls.current = null;
      stopAudio();
      analyser?.disconnect();
      if (context) {
        context.onstatechange = null;
        if (context.state !== "closed") void context.close().catch(() => {});
      }
      context = null;
      analyser = null;
    };
  }, []);

  React.useEffect(() => {
    tracksRef.current = tracks;
    controls.current?.reconcile();
  }, [tracks]);

  return {
    ...state,
    toggle: () => controls.current?.toggle(),
    select: (index: number) => controls.current?.select(index),
    seek: (time: number) => controls.current?.seek(time),
    setVolume: (value: number) => controls.current?.volume(value),
    toggleMute: () => controls.current?.mute(),
    cycleRepeat: () => controls.current?.repeat(),
    next: () => controls.current?.next(),
    previous: () => controls.current?.previous(),
    toggleShuffle: () => controls.current?.shuffle(),
  };
}
