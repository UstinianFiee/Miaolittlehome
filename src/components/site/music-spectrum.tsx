"use client";

import * as React from "react";

const BAR_COUNT = 72;
const FRAME_MS = 1000 / 30;

/** 只绘制实际频谱；暂停、后台与减少动效时只保留静态细环。 */
export const MusicSpectrum = React.memo(function MusicSpectrum({
  analyser, playing, className,
}: { analyser: AnalyserNode | null; playing: boolean; className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const data = new Uint8Array(analyser?.frequencyBinCount || 0);
    const levels = new Float32Array(BAR_COUNT);
    const binHz = analyser ? analyser.context.sampleRate / analyser.fftSize : 1;
    const upperHz = analyser ? Math.min(12000, analyser.context.sampleRate / 2) : 12000;
    const bands = Array.from({ length: BAR_COUNT }, (_, i) => ({
      low: 80 * Math.pow(upperHz / 80, i / BAR_COUNT) / binHz,
      high: 80 * Math.pow(upperHz / 80, (i + 1) / BAR_COUNT) / binHz,
      angle: (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2,
    }));
    let frame = 0;
    let last = -Infinity;
    let size = 0;
    let ratio = 1;
    let gradient: CanvasGradient;
    let ringColor: string;

    function refreshTheme() {
      if (!canvas || !ctx) return;
      const theme = getComputedStyle(canvas);
      // 兜底色：主题变量万一取不到（样式表还没到 / 被覆盖），
      // addColorStop 会直接抛 SyntaxError —— 那是在 effect 里抛的，
      // 会把整个页面带进错误边界。这里做一次最便宜的防御。
      ringColor = theme.getPropertyValue("--player-ring").trim() || "#3bbfb9";
      const ringSoft = theme.getPropertyValue("--player-ring-soft").trim() || "#a8ece6";
      const ringCyan = theme.getPropertyValue("--glow-cyan").trim() || "#5fdbe4";
      const ringPink = theme.getPropertyValue("--glow-pink").trim() || "#ff9ec7";
      try {
        gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, ringSoft);
        gradient.addColorStop(0.32, ringColor);
        gradient.addColorStop(0.62, ringCyan);
        gradient.addColorStop(0.82, ringPink);
        gradient.addColorStop(1, ringSoft);
      } catch {
        // 颜色确实无法解析时退化成单色，频谱照常绘制。
        gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, "#3bbfb9");
        gradient.addColorStop(1, "#a8ece6");
      }
      sync();
    }

    function draw(active: boolean) {
      if (!canvas || !ctx || !size) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const center = size / 2;
      const radius = size * 0.32;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (!active || !analyser) return;
      analyser.getByteFrequencyData(data);
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.2, size / 110);
      for (let i = 0; i < BAR_COUNT; i++) {
        const { low, high, angle } = bands[i];
        let energy = 0;
        let weight = 0;
        // 按频带与 FFT bin 的实际重叠加权，低频窄带也不产生空区间。
        for (let bin = Math.floor(low); bin < Math.ceil(high) && bin < data.length; bin++) {
          const overlap = Math.min(high, bin + 1) - Math.max(low, bin);
          if (overlap > 0) { energy += (data[bin] / 255) ** 2 * overlap; weight += overlap; }
        }
        const target = weight ? Math.sqrt(energy / weight) : 0;
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.52 : 0.22);
        if (levels[i] < 0.008) continue;
        // 振幅收紧：早先是 size * 0.125（光柱向外甩出老远，像放射光环），
        // 现在收到 0.055 —— 频谱是封面的"呼吸描边"，不是主体，别抢封面的注意力。
        const length = levels[i] * size * 0.055;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        ctx.globalAlpha = 0.35 + levels[i] * 0.65;
        ctx.strokeStyle = gradient;
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = 1;
        ctx.beginPath();
        ctx.moveTo(center + x * (radius + 2), center + y * (radius + 2));
        ctx.lineTo(center + x * (radius + 2 + length), center + y * (radius + 2 + length));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function allowed() {
      return playing && analyser?.context.state === "running" && !document.hidden && !motion.matches;
    }
    function tick(now: number) {
      frame = 0;
      if (!allowed()) { draw(false); return; }
      if (now - last >= FRAME_MS) {
        last = now - ((now - last) % FRAME_MS || 0);
        if (!Number.isFinite(last)) last = now;
        draw(true);
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      levels.fill(0);
      last = -Infinity;
      draw(false);
      if (allowed()) frame = requestAnimationFrame(tick);
    }
    function resize() {
      if (!canvas || !ctx) return;
      size = canvas.getBoundingClientRect().width;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      refreshTheme();
    }
    const observer = new ResizeObserver(resize);
    const themeObserver = new MutationObserver(refreshTheme);
    observer.observe(canvas);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    analyser?.context.addEventListener("statechange", sync);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      analyser?.context.removeEventListener("statechange", sync);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [analyser, playing]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});
