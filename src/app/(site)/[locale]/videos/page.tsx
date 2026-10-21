import { FilmIcon, PinIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DualTime } from "@/components/site/dual-time";
import { VideoThumb } from "@/components/video-thumb";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { resizedImageUrl } from "@/lib/image-url";
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
      <header className="page-heading mb-8 flex items-baseline justify-between gap-4">
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
              <Link href={`/videos/${video.id}`} className="group block">
                {/*
                  录像带：上面是「标签」（封面图），下面是一条磁条 ——
                  两个带盘悬停时转起来，右侧渐隐的是透过磁带窗看到的带基。
                */}
                <div className="tape-case lift surface overflow-hidden rounded-lg">
                  <div className="relative overflow-hidden">
                    {video.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resizedImageUrl(video.cover, 640)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-video w-full object-cover"
                      />
                    ) : video.sourceType === "local" ? (
                      /* 没设封面时用视频首帧兜底，比一个胶片图标有用得多 */
                      <VideoThumb
                        src={video.srcUrl}
                        className="aspect-video w-full object-cover"
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
                    {/* 磁带窗：右侧渐露出带基 */}
                    <span aria-hidden className="tape-window" />
                    <Badge variant="secondary" className="absolute top-2 left-2">
                      {video.sourceType === "iframe" ? t("videos.iframeSource") : t("videos.localSource")}
                    </Badge>
                  </div>

                  {/* 磁条 */}
                  <div
                    aria-hidden
                    className="flex items-center gap-3 border-t border-border/60 px-3 py-2.5"
                  >
                    <span className="tape-reel size-7 shrink-0" />
                    <span className="tape-reel size-7 shrink-0" />
                    <span className="h-1 flex-1 rounded-full bg-muted" />
                    <FilmIcon className="size-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="mt-3 space-y-1 px-1">
                  <p className="flex items-center gap-1.5 font-medium underline-offset-4 transition-colors group-hover:text-primary group-hover:underline">
                    {video.pinned ? <PinIcon className="size-3.5 text-primary" /> : null}
                    {pickLocalized(locale, video.title, video.titleEn)}
                  </p>
                  {video.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{video.description}</p>
                  ) : null}
                </div>
              </Link>
              <DualTime date={video.createdAt} className="mt-1 ml-1 text-[0.8rem] leading-[1.6] text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
