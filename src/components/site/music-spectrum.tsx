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

    function draw(active: boolean) {
      if (!canvas || !ctx || !size) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const center = size / 2;
      const radius = size * 0.335;
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
        const length = levels[i] * size * 0.125;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        const color = `hsl(${185 + 125 * (x + 1) / 2} 90% 72%)`;
        ctx.globalAlpha = 0.35 + levels[i] * 0.65;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
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
      gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, "#67e8f9");
      gradient.addColorStop(0.5, "#a5b4fc");
      gradient.addColorStop(1, "#f0abfc");
      sync();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    analyser?.context.addEventListener("statechange", sync);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      analyser?.context.removeEventListener("statechange", sync);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [analyser, playing]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});
