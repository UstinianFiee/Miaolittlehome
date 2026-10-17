"use client";

import { UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { VideoThumb } from "@/components/video-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFileInChunks } from "@/lib/client-upload";
import { attachVideoThumbnail } from "@/lib/video-thumb-client";

export type MediaOption = { id: number; path: string; title: string };

/** 兼容旧引用名。 */
export type ImageOption = MediaOption;

/**
 * 媒体字段：手填路径 / 直接上传 / 从媒体库挑选，并即时预览。
 * 上传走与媒体库相同的分片接口，完成后自动回填路径。
 * 站点信息（图片 / 视频）、个人资料头像共用。
 */
export function MediaField({
  id,
  label,
  hint,
  value,
  onChange,
  options,
  accept = "image/*",
  preview = "image",
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  /** 「从媒体库选择」里可选的条目 */
  options: MediaOption[];
  /** 文件选择框的 accept */
  accept?: string;
  /** 预览方式：图片用 img，视频用 video */
  preview?: "image" | "video";
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // 清空 input，允许再次选择同一个文件
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    const outcome = await uploadFileInChunks(file, {
      init: "/api/admin/media/upload/init",
      chunk: "/api/admin/media/upload/chunk",
      complete: "/api/admin/media/upload/complete",
    });

    setUploading(false);

    if (!outcome.ok) {
      setUploadError(outcome.message);
      return;
    }

    const data = outcome.data as { id?: number; path?: string } | null;
    // 视频补一张真封面（失败不影响主文件，见 video-thumb-client.ts）
    await attachVideoThumbnail(file, data?.id);

    if (data?.path) {
      onChange(data.path);
    }
  }

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}

      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/media/…"
          maxLength={500}
          className="min-w-0 flex-1"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="press shrink-0"
          disabled={uploading}
          aria-busy={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <span className="loading-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          ) : (
            <>
              <UploadIcon className="size-4" />
              {t("adminSite.upload")}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="press shrink-0"
          onClick={() => setOpen((prev) => !prev)}
        >
          {preview === "video" ? t("adminSite.pickVideo") : t("adminSite.pickImage")}
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleUpload}
      />

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

      {uploadError ? (
        <p role="alert" className="text-xs text-destructive">
          {uploadError}
        </p>
      ) : null}

      {value ? (
        preview === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={value} muted playsInline controls className="max-h-40 w-auto rounded border border-border" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="max-h-24 w-auto rounded border border-border object-contain"
          />
        )
      ) : null}

      {open ? (
        options.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {preview === "video" ? t("adminSite.noVideo") : t("adminSite.noImage")}
          </p>
        ) : (
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded border border-border p-2 sm:grid-cols-4">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.title}
                onClick={() => {
                  onChange(option.path);
                  setOpen(false);
                }}
                className="overflow-hidden rounded border border-border transition-colors hover:border-primary"
              >
                {preview === "video" ? (
                  <VideoThumb
                    src={option.path}
                    className="aspect-square w-full object-cover"
                    fallback={
                      <span className="flex aspect-square w-full items-center justify-center bg-muted/40 p-1 text-[0.6rem] break-all text-muted-foreground">
                        {option.title}
                      </span>
                    }
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={option.path}
                    alt={option.title}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
