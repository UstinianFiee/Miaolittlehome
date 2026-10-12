import { getTranslations } from "next-intl/server";

import { FooterWaves } from "@/components/site/footer-waves";
import { getSiteInfo } from "@/lib/settings";

/**
 * 全站页脚。
 *
 * 结构：顶部 3 层波浪（`FooterWaves`）→ 站点名 + 一句描述 → 版权与技术栈 → 备案区。
 * 备案号与链接来自后台设置（`site.icp` / `site.icpLink`、`site.police` / `site.policeLink`），
 * **各自独立，没配置的那一项不渲染**。
 * 底色用 `--footer-bg`，与波浪渐变的下端色一致，接缝看不出来。
 */
export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  const { name, author, description, icp, icpLink, police, policeLink } = await getSiteInfo();

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

        {/* 备案区：ICP 与公安网备各自独立，没配的那项不出现 */}
        {icp || police ? (
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {icp ? (
              icpLink ? (
                <a
                  href={icpLink}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="link-underline transition-colors hover:text-primary"
                >
                  {icp}
                </a>
              ) : (
                <span>{icp}</span>
              )
            ) : null}

            {police ? (
              policeLink ? (
                <a
                  href={policeLink}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="link-underline transition-colors hover:text-primary"
                >
                  {police}
                </a>
              ) : (
                <span>{police}</span>
              )
            ) : null}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
