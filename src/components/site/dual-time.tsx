"use client";

import { Clock3Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import * as React from "react";

import { dualTimeParts } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/** SSR uses UTC+8; after hydration the browser supplies the reader's local zone. */
export function DualTime({ date, variant = "inline", className, showDate = true }: {
  date: Date | string;
  variant?: "inline" | "stacked";
  className?: string;
  showDate?: boolean;
}) {
  const t = useTranslations("timeDisplay");
  const locale = useLocale();
  const mounted = React.useSyncExternalStore(subscribe, () => true, () => false);
  const [open, setOpen] = React.useState(false);
  const pinned = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();
  const cancelClose = () => { if (timer.current) clearTimeout(timer.current); };
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const enter = () => { cancelClose(); setOpen(true); };
  const leave = () => {
    cancelClose();
    if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 160);
  };
  const changeOpen = (value: boolean) => { cancelClose(); pinned.current = false; setOpen(value); };
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return <span className={className}>{String(date)}</span>;
  const parts = dualTimeParts(value);
  let main = showDate ? parts.utc8Full : parts.time;
  let zone = "UTC+8";
  if (mounted) {
    const fields = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(value);
    const field = (type: Intl.DateTimeFormatPartTypes) => fields.find(p => p.type === type)?.value ?? "";
    main = `${showDate ? `${field("year")}-${field("month")}-${field("day")} ` : ""}${field("hour")}:${field("minute")}`;
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Anchor asChild>
        <button
          ref={trigger} type="button" className={cn("dual-time", `dual-time--${variant}`, className)}
          aria-label={`${main} · ${mounted ? t("local") : "UTC+8"} · ${t("expand")}`}
          aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog"
          data-local={mounted} data-state={open ? "open" : "closed"}
          onPointerEnter={e => { if (e.pointerType === "mouse") enter(); }} onPointerLeave={leave}
          onFocus={e => { if (e.currentTarget.matches(":focus-visible")) enter(); }}
          onBlur={leave}
          onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") changeOpen(false); }}
          onClick={e => { e.preventDefault(); e.stopPropagation(); cancelClose(); pinned.current = !pinned.current; setOpen(pinned.current); }}
        >
          <time dateTime={parts.iso} className="dual-time__main">{main}</time>
          <Clock3Icon aria-hidden className="dual-time__icon" />
        </button>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content id={id} side="top" sideOffset={9} collisionPadding={12}
          className="time-popover" aria-label={t("expand")}
          onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}
          onPointerEnter={cancelClose} onPointerLeave={leave}
          onInteractOutside={e => { if (trigger.current?.contains(e.target as Node)) e.preventDefault(); }}
          onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
        >
          <span className="time-popover__zone">{mounted ? t("local") : t("reference")} · {zone}</span>
          <span className="time-popover__row"><span>UTC</span><time dateTime={parts.iso}>{parts.utcFull}</time></span>
          <span className="time-popover__row"><span>UTC+8</span><time dateTime={parts.iso}>{parts.utc8Full}</time></span>
          <Popover.Arrow className="time-popover__arrow" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
