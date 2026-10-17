"use client";

import { UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { MEDIA_ACCEPT } from "@/lib/media-extensions";
import { attachVideoThumbnail } from "@/lib/video-thumb-client";

type InitResponse = {
  ok: boolean;
  error?: string;
  data?: { uploadId: string; chunkSize: number; totalChunks: number };
};

/**
 * 分片上传：init → chunk(可多片) → complete。
 * 单文件 ≤ 10MB 时只有 1 片；超过则按服务端返回的分片大小逐片发送。
 * 不做断点续传（docs/SPEC.md 明确本期不做）。
 */
export function FileUploader({
  onUploaded,
  albumId,
}: {
  onUploaded: () => void;
  albumId?: number | null;
}) {
  const t = useTranslations();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [pending, setPending] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  async function readError(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return payload?.error ?? fallback;
  }

  async function uploadOne(file: File): Promise<number | undefined> {
    const initResponse = await fetch("/api/admin/media/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, size: file.size }),
    });

    if (!initResponse.ok) {
      throw new Error(await readError(initResponse, "init"));
    }

    const init = (await initResponse.json()) as InitResponse;
    const { uploadId, chunkSize, totalChunks } = init.data!;

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const blob = file.slice(start, Math.min(start + chunkSize, file.size));

      const chunkResponse = await fetch("/api/admin/media/upload/chunk", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-upload-id": uploadId,
          "x-chunk-index": String(index),
        },
        body: blob,
      });

      if (!chunkResponse.ok) {
        throw new Error(await readError(chunkResponse, "chunk"));
      }

      setProgress(Math.round(((index + 1) / totalChunks) * 100));
    }

    const completeResponse = await fetch("/api/admin/media/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        size: file.size,
        totalChunks,
        albumId: albumId ?? null,
      }),
    });

    if (!completeResponse.ok) {
      throw new Error(await readError(completeResponse, "complete"));
    }

    const payload = (await completeResponse.json().catch(() => null)) as
      | { data?: { id?: number } }
      | null;
    return payload?.data?.id;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        setProgress(0);
        const mediaId = await uploadOne(file);
        // 视频在上传完成后补一张真封面（失败不影响主文件，见 video-thumb-client.ts）
        await attachVideoThumbnail(file, mediaId);
      }
      onUploaded();
    } catch (uploadError) {
      setError(
        t("media.uploadFailed", {
          message: uploadError instanceof Error ? uploadError.message : "",
        })
      );
    } finally {
      setPending(false);
      setProgress(0);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
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
