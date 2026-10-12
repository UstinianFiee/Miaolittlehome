import { ArrowLeftIcon, DownloadIcon, PackageIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatBytes } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { getPublishedSoftware, listPublishedSoftwareIds } from "@/lib/software";

type Props = { params: Promise<{ locale: string; id: string }> };

const PLATFORM_LABEL_KEYS: Record<string, string> = {
  windows: "software.platformWindows",
  macos: "software.platformMacos",
  linux: "software.platformLinux",
  android: "software.platformAndroid",
  ios: "software.platformIos",
};

export async function generateStaticParams() {
  const items = await listPublishedSoftwareIds();

  return routing.locales.flatMap((locale) =>
    items.map((item) => ({ locale, id: String(item.id) }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const item = await getPublishedSoftware(Number(id));

  if (!item) {
    return {};
  }

  return {
    ...buildPageMetadata({ locale, path: `/software/${item.id}`, titleKey: "nav.software" }),
    title: pickLocalized(locale, item.name, item.nameEn),
    description: item.description,
  };
}

export default async function SoftwareDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const softwareId = Number(id);
  const item = Number.isInteger(softwareId) ? await getPublishedSoftware(softwareId) : null;

  if (!item) {
    // 走 notFound()：返回真正的 404 状态码，文案在同级 not-found.tsx 里
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8 space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/software">
            <ArrowLeftIcon className="size-4" />
            {t("software.title")}
          </Link>
        </Button>

        <div className="flex items-start gap-4">
          {item.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.icon}
              alt=""
              className="size-16 shrink-0 rounded-lg border border-border/60 object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
              <PackageIcon className="size-7 text-muted-foreground" />
            </div>
          )}

          <div className="min-w-0 space-y-2">
            <h1 className="font-display text-2xl">
              {pickLocalized(locale, item.name, item.nameEn)}
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          {t("software.files")} · {item.files.length}
        </h2>

        {item.files.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            {t("software.noFiles")}
          </p>
        ) : (
          <div className="rounded-lg border border-border/60 bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("software.version")}</TableHead>
                  <TableHead className="w-28">{t("software.platform")}</TableHead>
                  <TableHead className="w-24 text-right">{t("software.fileSize")}</TableHead>
                  <TableHead className="w-28 text-right">{t("software.downloads")}</TableHead>
                  <TableHead className="w-28 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <span className="font-medium">{file.version}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {file.fileName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t(PLATFORM_LABEL_KEYS[file.platform] ?? file.platform)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatBytes(file.fileSize.toString())}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {file.downloads}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* 走下载接口：先计数再 302 到真实文件 */}
                      <Button asChild size="sm">
                        <a href={`/api/software/download/${file.id}`} data-testid={`download-${file.id}`}>
                          <DownloadIcon className="size-4" />
                          {t("software.download")}
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
