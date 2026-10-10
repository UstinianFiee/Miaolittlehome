"use client";

import * as React from "react";

/**
 * 全局水波纹：点击带 `.ripple` 类的元素时，从点击位置扩散一圈。
 * 用事件委托实现，不给每个按钮加监听；半径取到最远的角，保证铺满容器。
 */
export function RippleLayer() {
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const host = (event.target as HTMLElement | null)?.closest<HTMLElement>(".ripple");
      if (!host) {
        return;
      }

      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const radius = Math.hypot(
        Math.max(x, rect.width - x),
        Math.max(y, rect.height - y)
      );

      const wave = document.createElement("span");
      wave.className = "ripple-wave";
      wave.style.left = `${x}px`;
      wave.style.top = `${y}px`;
      wave.style.width = `${radius * 2}px`;
      wave.style.height = `${radius * 2}px`;
      host.appendChild(wave);

      window.setTimeout(() => wave.remove(), 680);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
