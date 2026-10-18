"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

/**
 * 页脚的主题切换（Light / Dark / Auto）。
 *
 * 参考站点把主题切换放在页脚；这里用与站点一致的胶囊样式实现。
 * 首屏（未挂载）时所有按钮都不标 active，避免 next-themes 在服务端无法
 * 得知真实主题导致水合不一致。
 */
const OPTIONS = [
  { value: "light", labelKey: "footer.light" },
  { value: "dark", labelKey: "footer.dark" },
  { value: "system", labelKey: "footer.auto" },
] as const;

export function FooterThemeSwitch() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <div className="footer-theme" role="group" aria-label={t("footer.theme")}>
      {OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-active={active ? "true" : "false"}
            aria-pressed={active ? true : undefined}
            onClick={() => setTheme(option.value)}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
