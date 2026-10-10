"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

/**
 * 视频播放器：本地 MP4 用 <video>，外链用 <iframe>。
 * 本地文件不存在或格式不受支持时给出明确提示，而不是留一个坏掉的播放器。
 */
export function VideoPlayer({
  sourceType,
  srcUrl,
  poster,
  title,
}: {
  sourceType: string;
  srcUrl: string;
  poster: string | null;
  title: string;
}) {
  const t = useTranslations();
  const [failed, setFailed] = React.useState(false);

  if (sourceType === "iframe") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/60">
        <iframe
          src={srcUrl}
          title={title}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border/60 bg-black">
        {failed ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-center text-sm text-white/80">
            <AlertTriangleIcon className="size-6" />
            <p className="max-w-md px-4">{t("videos.loadFailed")}</p>
          </div>
        ) : (
          <video
            controls
            preload="metadata"
            playsInline
            poster={poster ?? undefined}
            onError={() => setFailed(true)}
            className="aspect-video w-full"
            data-testid="video-element"
          >
            <source src={srcUrl} />
          </video>
        )}
      </div>
    </div>
  );
}
