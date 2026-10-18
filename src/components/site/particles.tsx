"use client";

import * as React from "react";

/**
 * 轻量 canvas 粒子背景（零依赖）。
 * 粒子数量随画布面积自适应，超出上限就停止增长；
 * 尊重 prefers-reduced-motion —— 该偏好下不绘制任何粒子。
 */
export function Particles({ className }: { className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // 收窄后的别名：TypeScript 不会把收窄结果带进下面的闭包
    const el = canvas;
    const c = ctx;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;

    type Particle = { x: number; y: number; r: number; vx: number; vy: number; a: number };
    let particles: Particle[] = [];

    function resize() {
      const rect = el.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const count = Math.max(24, Math.min(90, Math.round((width * height) / 24000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        a: Math.random() * 0.45 + 0.18,
      }));
    }

    function frame() {
      c.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -5) particle.x = width + 5;
        if (particle.x > width + 5) particle.x = -5;
        if (particle.y < -5) particle.y = height + 5;
        if (particle.y > height + 5) particle.y = -5;

        c.beginPath();
        c.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(57, 197, 187, ${particle.a})`;
        c.fill();
      }

      raf = window.requestAnimationFrame(frame);
    }

    function onResize() {
      resize();
      seed();
    }

    resize();
    seed();
    frame();
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
