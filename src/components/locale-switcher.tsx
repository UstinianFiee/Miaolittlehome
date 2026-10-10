"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";

/** 语言切换：点击直接在语言间轮换（不再弹下拉），保持当前页面路径。 */
export function LocaleSwitcher() {
  const t = useTranslations();
  const activeLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentIndex = locales.indexOf(activeLocale as Locale);
  const nextLocale = locales[(currentIndex + 1) % locales.length];

  function handleSwitch() {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleSwitch}
      aria-label={t("actions.switchLanguage")}
      aria-busy={isPending}
      title={t(`locale.${nextLocale}`)}
      className="press"
    >
      <LanguagesIcon className="size-[1.05rem]" />
    </Button>
  );
}
