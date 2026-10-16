import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DualTime } from "@/components/site/dual-time";
import { VideoPlayer } from "@/components/site/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
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
    // 走 notFound()：返回真正的 404 状态码，文案在同级 not-found.tsx 里
    notFound();
  }

  const title = pickLocalized(locale, video.title, video.titleEn);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <header className="page-heading mb-6 space-y-3">
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
          <DualTime date={video.createdAt} />
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
