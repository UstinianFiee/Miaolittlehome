import { FilmIcon, PinIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { VideoThumb } from "@/components/video-thumb";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatDual } from "@/lib/datetime";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listPublishedVideos } from "@/lib/videos";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/videos", titleKey: "nav.videos" });
}

export default async function VideosPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const videos = await listPublishedVideos();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl">{t("videos.title")}</h1>
        <span className="text-sm text-muted-foreground">
          {t("videos.count", { count: videos.length })}
        </span>
      </header>

      {videos.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("videos.empty")}</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <Link
                href={`/videos/${video.id}`}
                className="surface group block overflow-hidden transition-all duration-300 hover:border-primary/45 hover:shadow-md"
              >
                <div className="relative overflow-hidden">
                  {video.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.cover}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : video.sourceType === "local" ? (
                    /* 没设封面时用视频首帧兜底，比一个胶片图标有用得多 */
                    <VideoThumb
                      src={video.srcUrl}
                      className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      fallback={
                        <div className="flex aspect-video w-full items-center justify-center">
                          <FilmIcon className="size-8 text-muted-foreground" />
                        </div>
                      }
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center">
                      <FilmIcon className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute top-2 left-2">
                    {video.sourceType === "iframe" ? t("videos.iframeSource") : t("videos.localSource")}
                  </Badge>
                </div>

                <div className="space-y-1 p-4">
                  <p className="flex items-center gap-1.5 font-medium underline-offset-4 transition-colors group-hover:text-primary group-hover:underline">
                    {video.pinned ? <PinIcon className="size-3.5 text-primary" /> : null}
                    {pickLocalized(locale, video.title, video.titleEn)}
                  </p>
                  {video.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{video.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{formatDual(video.createdAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
