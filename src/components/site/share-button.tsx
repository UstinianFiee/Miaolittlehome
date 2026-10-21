"use client";

import { CheckIcon, LinkIcon, QrCodeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * 文章分享：二维码 / 复制链接（按用户要求移除系统分享）。
 * 二维码库按需加载，不进入文章页的首屏包。
 */
export function ShareButton({ path }: { path: string }) {
  const t = useTranslations();

  const [url, setUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState("");

  React.useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用（非 HTTPS 等）时保持静默
    }
  }

  async function prepareQr() {
    if (!url || qrDataUrl) {
      return;
    }
    try {
      const { default: QRCode } = await import("qrcode");
      setQrDataUrl(
        await QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      );
    } catch {
      // 生成失败则保持空态
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="share-actions">
      <Button type="button" variant="outline" size="sm" className="max-sm:h-11" onClick={() => void copyLink()}>
        {copied ? <CheckIcon className="size-4 text-primary" /> : <LinkIcon className="size-4" />}
        {copied ? t("share.copied") : t("share.copy")}
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="max-sm:h-11" onClick={() => void prepareQr()}>
            <QrCodeIcon className="size-4" />
            {t("share.qr")}
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-0 sm:max-w-sm">
          <DialogHeader className="min-w-0">
            <DialogTitle className="break-words">{t("share.qrTitle")}</DialogTitle>
            <DialogDescription className="min-w-0 truncate">{url}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={t("share.qrTitle")}
                width={240}
                height={240}
                data-testid="share-qr"
                /* max-w-full + h-auto：窄屏（320px）下不能把弹窗顶宽 */
                className="h-auto max-w-full rounded border border-border/60 bg-white p-2"
              />
            ) : (
              <div className="flex size-[240px] max-w-full items-center justify-center text-sm text-muted-foreground">
                {t("share.qrLoading")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
