import { BadgeCheckIcon, ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FooterThemeSwitch } from "@/components/site/footer-theme-switch";
import { Link } from "@/i18n/navigation";
import { getSiteInfo } from "@/lib/settings";

/**
 * 全站页脚（2026-10-18 精简版）。
 *
 * 结构：
 * - 第一行：Logo 胶囊 + 主题切换；
 * - 第二行：版权 / Powered by + 备案信息；
 * - 备案号带图标，ICP 与公网安备之间用细竖线分隔；
 * - 不再单独占一行 powered / 技术栈 / 备案，整体高度约减半；
 * - 手机底部保留播放器避让空间，桌面收起。
 */
export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  const { name, author, logo, icp, icpLink, police, policeLink } = await getSiteInfo();

  return (
    <footer className="site-footer mt-10 border-t border-border/60">
      <section className="mx-auto w-full max-w-5xl px-4 pt-5 pb-20 sm:px-6 sm:pt-6 sm:pb-24 lg:pb-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="footer-logo">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" width={28} height={28} loading="lazy" />
            ) : (
              <span aria-hidden className="footer-logo__mark" />
            )}
            <span className="max-w-[58vw] truncate">{name}</span>
          </Link>

          <FooterThemeSwitch />
        </div>

        <div className="footer-meta">
          <div className="footer-meta__left">
            <span>
              © {year} {author} · {t("footer.rights")}
            </span>
            <span aria-hidden className="footer-dot">
              ·
            </span>
            <span>{t("footer.poweredLine")}</span>
          </div>

          {icp || police ? (
            <div className="footer-filings">
              {icp ? (
                icpLink ? (
                  <a
                    href={icpLink}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="footer-filing"
                    aria-label={`${t("footer.icpLabel")}：${icp}`}
                    title={t("footer.icpLabel")}
                  >
                    <BadgeCheckIcon aria-hidden />
                    <span>{icp}</span>
                  </a>
                ) : (
                  <span className="footer-filing" title={t("footer.icpLabel")}>
                    <BadgeCheckIcon aria-hidden />
                    <span>{icp}</span>
                  </span>
                )
              ) : null}

              {icp && police ? (
                <span aria-hidden className="footer-filing__divider" />
              ) : null}

              {police ? (
                policeLink ? (
                  <a
                    href={policeLink}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="footer-filing"
                    aria-label={`${t("footer.policeLabel")}：${police}`}
                    title={t("footer.policeLabel")}
                  >
                    <ShieldCheckIcon aria-hidden />
                    <span>{police}</span>
                  </a>
                ) : (
                  <span className="footer-filing" title={t("footer.policeLabel")}>
                    <ShieldCheckIcon aria-hidden />
                    <span>{police}</span>
                  </span>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </footer>
  );
}
