"use client";

import { UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { uploadFileInChunks } from "@/lib/client-upload";
import { MEDIA_ACCEPT } from "@/lib/media-extensions";
import { attachVideoThumbnail } from "@/lib/video-thumb-client";

/**
 * 分片上传：init → chunk(可多片) → complete。
 * 单文件 ≤ 10MB 时只有 1 片；超过则按服务端返回的分片大小逐片发送。
 * 不做断点续传（docs/SPEC.md 明确本期不做）。
 *
 * 多文件时逐个上传：单个文件失败不会打断后面的文件，结束后统一提示并刷新列表。
 */
export function FileUploader({
  onUploaded,
  albumId,
}: {
  onUploaded: () => void;
  /** 当前筛选的相册；上传成功后文件直接归入该相册 */
  albumId?: number | null;
}) {
  const t = useTranslations();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [pending, setPending] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  async function uploadOne(file: File): Promise<number | undefined> {
    const outcome = await uploadFileInChunks(
      file,
      {
        init: "/api/admin/media/upload/init",
        chunk: "/api/admin/media/upload/chunk",
        complete: "/api/admin/media/upload/complete",
      },
      { albumId: albumId ?? null },
      setProgress
    );

    if (!outcome.ok) {
      throw new Error(outcome.message);
    }

    const data = outcome.data as { id?: number } | null;
    // 视频在上传完成后补一张真封面（失败不影响主文件，见 video-thumb-client.ts）
    await attachVideoThumbnail(file, data?.id);
    return data?.id;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setPending(true);
    setError(null);

    const succeeded: string[] = [];
    const failed: { name: string; message: string }[] = [];

    try {
      for (const file of Array.from(files)) {
        setProgress(0);
        try {
          await uploadOne(file);
          succeeded.push(file.name);
        } catch (uploadError) {
          failed.push({
            name: file.name,
            message: uploadError instanceof Error ? uploadError.message : "",
          });
        }
      }
    } finally {
      setPending(false);
      setProgress(0);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      // 部分成功或失败后也要刷新：已落库的文件不应在列表里“消失”
      onUploaded();
    }

    if (failed.length > 0) {
      setError(
        t("media.uploadPartial", {
          success: succeeded.length,
          failed: failed.length,
          detail: failed
            .map((item) => (item.message ? `${item.name}：${item.message}` : item.name))
            .join("；"),
        })
      );
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon className="size-4" />
          {pending ? t("media.uploading") : t("media.upload")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("media.uploadHint")}</span>
      </div>

      {pending ? (
        <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
