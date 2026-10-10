"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export type Photo = {
  id: number;
  src: string;
  thumb: string;
  title: string | null;
};

/**
 * 相册网格 + 大图浏览。
 * 自写轻量实现（零依赖）：点击打开、左右切换、Esc 关闭、触摸左右滑动。
 */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const t = useTranslations();
  const [index, setIndex] = React.useState<number | null>(null);
  const touchStartX = React.useRef<number | null>(null);

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

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft") {
        prev();
      } else if (event.key === "ArrowRight") {
        next();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, position) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(position)}
              aria-label={t("site.openPhoto")}
              className="group block w-full overflow-hidden rounded-md border border-border/60"
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
          role="dialog"
          aria-modal="true"
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
            type="button"
            aria-label={t("site.closeViewer")}
            onClick={close}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
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
            className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6"
          >
            <ChevronLeftIcon className="size-6" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.title ?? ""}
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
            className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6"
          >
            <ChevronRightIcon className="size-6" />
          </button>

          <p
            data-testid="photo-counter"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80"
          >
            {index + 1} / {photos.length}
            {current.title ? ` · ${current.title}` : ""}
          </p>
        </div>
      ) : null}
    </>
  );
}
