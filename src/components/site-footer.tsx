import { getTranslations } from "next-intl/server";

import { FooterWaves } from "@/components/site/footer-waves";
import { getSiteInfo } from "@/lib/settings";

/**
 * 全站页脚。
 *
 * 结构：顶部 3 层波浪（`FooterWaves`）→ 站点名 + 一句描述 → 版权与技术栈 → 备案区。
 * 备案号与链接来自后台设置（`site.icp` / `site.icpLink`），**没配置就整块不渲染**。
 * 底色用 `--footer-bg`，与波浪渐变的下端色一致，接缝看不出来。
 */
export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  const { name, author, description, icp, icpLink } = await getSiteInfo();

  return (
    <footer
      className="relative mt-14 border-t border-border/40 sm:mt-20"
      style={{ backgroundColor: "var(--footer-bg)" }}
    >
      <FooterWaves />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-7 text-center sm:px-6">
        <p className="font-display text-base" style={{ color: "var(--card-foreground)" }}>
          {name}
        </p>

        {description ? (
          <p className="max-w-xl text-sm text-muted-foreground text-balance">{description}</p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          © {year} {author} · {t("footer.rights")} · {t("footer.poweredBy")}
        </p>

        {/* 备案区：未配置备案号时整块不出现 */}
        {icp ? (
          <p className="text-xs text-muted-foreground">
            {icpLink ? (
              <a
                href={icpLink}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="link-underline transition-colors hover:text-primary"
              >
                {icp}
              </a>
            ) : (
              icp
            )}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
