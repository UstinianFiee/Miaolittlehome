"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { resizedImageUrl } from "@/lib/image-url";

export type Photo = {
  id: number;
  src: string;
  thumb: string;
  title: string | null;
};

/**
 * 相册网格 + 大图浏览。
 * 自写轻量实现（零依赖）：点击打开、左右切换、Esc 关闭、触摸左右滑动。
 *
 * 灯箱按 dialog 语义处理：
 * - 打开时把焦点移到关闭按钮，关闭后还原到触发缩略图；
 * - Tab / Shift+Tab 在灯箱内循环（简单 focus trap，不引依赖）；
 * - 大图走 `/img/1920/...`，右下角另给一个「查看大图」链接打开原图。
 */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const t = useTranslations();
  const [index, setIndex] = React.useState<number | null>(null);
  const touchStartX = React.useRef<number | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastFocused = React.useRef<HTMLElement | null>(null);

  const close = React.useCallback(() => setIndex(null), []);
  const prev = React.useCallback(
    () => setIndex((current) => (current === null ? null : (current - 1 + photos.length) % photos.length)),
    [photos.length]
  );
  const next = React.useCallback(
    () => setIndex((current) => (current === null ? null : (current + 1) % photos.length)),
    [photos.length]
  );

  const open = index !== null;

  React.useEffect(() => {
    if (!open) {
      return;
    }

    // 记下触发灯箱的缩略图，关闭时把焦点还回去
    lastFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "ArrowLeft") {
        prev();
        return;
      }
      if (event.key === "ArrowRight") {
        next();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      // 简单 focus trap：在灯箱内可聚焦元素之间循环
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocused.current?.focus?.({ preventScroll: true });
      lastFocused.current = null;
    };
  }, [open, close, prev, next]);

  if (photos.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">{t("albums.noPhotos")}</p>
    );
  }

  const current = index === null ? null : photos[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [&>li:only-child]:col-span-full">
        {photos.map((photo, position) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(position)}
              aria-label={photo.title ?? t("site.openPhoto")}
              className="group block w-full overflow-hidden rounded-md border border-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumb}
                alt={photo.title ?? ""}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {open && current ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${t("site.openPhoto")} ${index + 1}/${photos.length}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={close}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX ?? null;
            touchStartX.current = null;
            if (start === null || end === null) {
              return;
            }
            const delta = end - start;
            if (Math.abs(delta) < 40) {
              return;
            }
            if (delta > 0) {
              prev();
            } else {
              next();
            }
          }}
        >
          <button
            ref={closeRef}
            type="button"
            aria-label={t("site.closeViewer")}
            onClick={close}
            className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:top-4 sm:right-4"
          >
            <XIcon className="size-5" />
          </button>

          <button
            type="button"
            aria-label={t("site.prevPhoto")}
            onClick={(event) => {
              event.stopPropagation();
              prev();
            }}
            className="absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-6"
          >
            <ChevronLeftIcon className="size-6" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resizedImageUrl(current.src, 1920)}
            alt={current.title ?? ""}
            loading="eager"
            decoding="async"
            className="max-h-[86vh] max-w-[92vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />

          <button
            type="button"
            aria-label={t("site.nextPhoto")}
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
            className="absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6"
          >
            <ChevronRightIcon className="size-6" />
          </button>

          <p
            data-testid="photo-counter"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[0.8rem] leading-[1.6] text-white/85"
          >
            {index + 1} / {photos.length}
            {current.title ? ` · ${current.title}` : ""}
          </p>

          <a
            href={current.src}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 bottom-4 rounded-full bg-white/10 px-3 py-2 text-[0.8rem] text-white/85 hover:bg-white/20 hover:text-white sm:right-6"
            onClick={(event) => event.stopPropagation()}
          >
            {t("site.openPhoto")}
          </a>
        </div>
      ) : null}
    </>
  );
}
