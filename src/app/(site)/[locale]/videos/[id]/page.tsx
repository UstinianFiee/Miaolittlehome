import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { VideoPlayer } from "@/components/site/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatDual } from "@/lib/datetime";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { getPublishedVideo, listPublishedVideoIds } from "@/lib/videos";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateStaticParams() {
  const videos = await listPublishedVideoIds();

  return routing.locales.flatMap((locale) =>
    videos.map((video) => ({ locale, id: String(video.id) }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const video = await getPublishedVideo(Number(id));

  if (!video) {
    return {};
  }

  const title = pickLocalized(locale, video.title, video.titleEn);
  const description = video.description ?? undefined;

  return {
    ...buildPageMetadata({ locale, path: `/videos/${video.id}`, titleKey: "nav.videos" }),
    title,
    ...(description ? { description } : {}),
  };
}

export default async function VideoDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const videoId = Number(id);
  const video = Number.isInteger(videoId) ? await getPublishedVideo(videoId) : null;

  if (!video) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-muted-foreground">{t("videos.notFound")}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/videos">
            <ArrowLeftIcon className="size-4" />
            {t("videos.backToList")}
          </Link>
        </Button>
      </div>
    );
  }

  const title = pickLocalized(locale, video.title, video.titleEn);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-6 space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/videos">
            <ArrowLeftIcon className="size-4" />
            {t("videos.title")}
          </Link>
        </Button>

        <h1 className="font-display text-2xl">{title}</h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="secondary">
            {video.sourceType === "iframe" ? t("videos.iframeSource") : t("videos.localSource")}
          </Badge>
          <time dateTime={video.createdAt.toISOString()}>{formatDual(video.createdAt)}</time>
        </div>
      </header>

      <VideoPlayer
        sourceType={video.sourceType}
        srcUrl={video.srcUrl}
        poster={video.cover}
        title={title}
      />

      {video.description ? (
        <p className="mt-6 text-sm leading-7 text-muted-foreground">{video.description}</p>
      ) : null}
    </div>
  );
}
