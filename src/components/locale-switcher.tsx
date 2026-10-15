"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";

/** Language switcher. A document navigation avoids stale RSC state between locales. */
export function LocaleSwitcher() {
  const t = useTranslations();
  const activeLocale = useLocale();
  const pathname = usePathname();
  const [pending, setPending] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = locales.indexOf(activeLocale as Locale);
  const nextLocale = locales[(currentIndex + 1) % locales.length];

  React.useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (navigationRef.current) clearTimeout(navigationRef.current);
    };
  }, []);

  function handleSwitch() {
    if (pending) return;
    setPending(true);

    const target = new URL(window.location.href);
    target.pathname = `/${nextLocale}${pathname === "/" ? "" : pathname}`;
    // A hard locale navigation clears any stale client-side route cache and
    // ensures the next locale's dictionaries/layout are loaded as one document.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navigationRef.current = setTimeout(() => window.location.assign(target.toString()), reduceMotion ? 0 : 180);

    timeoutRef.current = setTimeout(() => setPending(false), 10_000);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleSwitch}
      aria-label={t("actions.switchLanguage")}
      aria-busy={pending}
      disabled={pending}
      title={t(`locale.${nextLocale}`)}
      className="press switch-control"
      data-switching={pending}
      data-testid="locale-switch"
    >
      <LanguagesIcon aria-hidden className="language-glyph size-[1.05rem]" />
      <span aria-hidden className="language-target">{nextLocale === "en" ? "EN" : "中"}</span>
    </Button>
  );
}
