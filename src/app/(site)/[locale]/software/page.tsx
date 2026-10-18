import { PackageIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatBytes } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listPublishedSoftware, PLATFORMS } from "@/lib/software";

type Props = { params: Promise<{ locale: string }> };

const PLATFORM_LABEL_KEYS: Record<string, string> = {
  windows: "software.platformWindows",
  macos: "software.platformMacos",
  linux: "software.platformLinux",
  android: "software.platformAndroid",
  ios: "software.platformIos",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/software", titleKey: "nav.software" });
}

export default async function SoftwarePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const items = await listPublishedSoftware();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <header className="page-heading mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl">{t("software.title")}</h1>
        <span className="text-sm text-muted-foreground">
          {t("software.count", { count: items.length })}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("software.empty")}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const downloads = item.files.reduce((sum, file) => sum + file.downloads, 0);
            const platforms = [...new Set(item.files.map((file) => file.platform))].sort(
              (a, b) => PLATFORMS.indexOf(a) - PLATFORMS.indexOf(b)
            );

            return (
              <li key={item.id}>
                <Link
                  href={`/software/${item.id}`}
                  className="surface group flex gap-4 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                >
                  {item.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.icon}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-lg border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                      <PackageIcon className="size-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium underline-offset-4 transition-colors group-hover:text-primary group-hover:underline">
                      {pickLocalized(locale, item.name, item.nameEn)}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {platforms.map((platform) => (
                        <Badge key={platform} variant="secondary">
                          {t(PLATFORM_LABEL_KEYS[platform] ?? platform)}
                        </Badge>
                      ))}
                      <span>
                        {t("software.version")} × {item.files.length}
                      </span>
                      <span>· {t("software.totalDownloads", { count: downloads })}</span>
                      {item.files[0] ? (
                        <span>· {formatBytes(item.files[0].fileSize.toString())}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
