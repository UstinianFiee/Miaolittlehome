"use client";

import * as React from "react";

type Point = { x: number; y: number };
type Bounds = { left: number; top: number; right: number; bottom: number };
type Drag = { pointerId: number; start: Point; origin: Point; moved: boolean; target: HTMLElement };
const POSITION_KEY = "music-player-position";
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(min, max), Math.max(min, value));

export function usePlayerPosition(visible: boolean, expanded: boolean, statusVisible: boolean) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const statusRef = React.useRef<HTMLDivElement>(null);
  const safeAreaRef = React.useRef<HTMLSpanElement>(null);
  const position = React.useRef<Point | null>(null);
  const drag = React.useRef<Drag | null>(null);
  const suppressClick = React.useRef(false);
  const [dragging, setDragging] = React.useState(false);

  const bounds = React.useCallback((): Bounds => {
    const viewport = window.visualViewport;
    const safe = safeAreaRef.current ? getComputedStyle(safeAreaRef.current) : null;
    const inset = (value?: string) => Number.parseFloat(value || "0") || 0;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    return {
      left: left + 12 + inset(safe?.paddingLeft),
      top: top + 12 + inset(safe?.paddingTop),
      right: left + (viewport?.width || document.documentElement.clientWidth) - 12 - inset(safe?.paddingRight),
      bottom: top + (viewport?.height || window.innerHeight) - 12 - inset(safe?.paddingBottom),
    };
  }, []);

  const place = React.useCallback((point: Point | null, save = false) => {
    const root = rootRef.current;
    if (!root) return;
    const area = bounds();
    const size = root.offsetWidth;
    const next = {
      x: clamp(point?.x ?? area.right - size, area.left, area.right - size),
      y: clamp(point?.y ?? area.bottom - size, area.top, area.bottom - size),
    };
    position.current = next;
    root.style.left = `${next.x}px`;
    root.style.top = `${next.y}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    const panel = panelRef.current || (statusVisible ? statusRef.current : null);
    if (panel) {
      const width = Math.min(panelRef.current ? 336 : 260, Math.max(0, area.right - area.left));
      const gap = 12;
      const above = next.y - area.top - gap;
      const below = area.bottom - next.y - size - gap;
      const left = next.x - area.left - gap;
      const right = area.right - next.x - size - gap;
      // 优先侧放；窄屏在球体上/下方展开，不参与球体的文档布局。
      const side = left >= width || right >= width;
      panel.style.width = `${width}px`;
      panel.style.maxHeight = `${Math.max(0, side ? area.bottom - area.top : Math.max(above, below))}px`;
      const height = panel.getBoundingClientRect().height;
      const x = side
        ? left >= width ? next.x - width - gap : next.x + size + gap
        : next.x + size / 2 - width / 2;
      const y = side
        ? next.y + size / 2 - height / 2
        : above >= below ? next.y - gap - height : next.y + size + gap;
      panel.style.left = `${clamp(x, area.left, area.right - width)}px`;
      panel.style.top = `${clamp(y, area.top, area.bottom - height)}px`;
    }
    if (save) {
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* 存储受限时仍可拖动。 */ }
    }
  }, [bounds, statusVisible]);

  React.useLayoutEffect(() => {
    if (!visible) return;
    if (!position.current) {
      try {
        const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
        if (saved && typeof saved.x === "number" && typeof saved.y === "number" && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position.current = saved;
      } catch { /* 损坏坐标恢复右下角。 */ }
    }
    const update = () => place(position.current);
    update();
    const observer = new ResizeObserver(update);
    if (rootRef.current) observer.observe(rootRef.current);
    if (panelRef.current) observer.observe(panelRef.current);
    if (statusVisible && statusRef.current) observer.observe(statusRef.current);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [visible, expanded, place]);

  React.useEffect(() => () => {
    const active = drag.current;
    if (active?.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    drag.current = null;
  }, []);

  function finish(event: React.PointerEvent<HTMLElement>, cancelled = false) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    suppressClick.current = active.moved || cancelled;
    if (active.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    if (active.moved) place(position.current, true);
    setDragging(false);
  }

  return {
    rootRef, panelRef, statusRef, safeAreaRef, dragging,
    dragHandlers: {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-player-drag]");
        const control = (event.target as HTMLElement).closest("button,input,a");
        if (!target || (control && control !== target)) return;
        suppressClick.current = false;
        if (!position.current) place(null);
        drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: position.current!, moved: false, target };
        // 捕获在实际按钮/手柄上，普通点击仍保留原生按钮语义。
        target.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const dx = event.clientX - active.start.x;
        const dy = event.clientY - active.start.y;
        if (!active.moved && Math.hypot(dx, dy) < 6) return;
        if (!active.moved) { active.moved = true; setDragging(true); }
        event.preventDefault();
        place({ x: active.origin.x + dx, y: active.origin.y + dy });
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => finish(event),
      onPointerCancel: (event: React.PointerEvent<HTMLElement>) => finish(event, true),
      onLostPointerCapture: (event: React.PointerEvent<HTMLElement>) => finish(event, true),
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (!(event.target instanceof HTMLElement) || !event.target.hasAttribute("data-player-drag")) return;
        const step = event.shiftKey ? 24 : 8;
        const delta: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
        if (event.key === "Home") { event.preventDefault(); place(null, true); }
        else if (delta[event.key] && position.current) {
          event.preventDefault();
          place({ x: position.current.x + delta[event.key].x, y: position.current.y + delta[event.key].y }, true);
        }
      },
    },
  };
}
