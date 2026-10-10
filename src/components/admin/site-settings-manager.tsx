"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { MediaField, type MediaOption } from "@/components/admin/media-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type SiteInfoRow = {
  name: string;
  author: string;
  description: string;
  subtitle: string;
  logo: string;
  background: string;
  backgrounds: string[];
  backgroundVideo: string;
  pageBackground: string;
  postBackground: string;
  favicon: string;
  icp: string;
  icpLink: string;
};

export type { MediaOption };

/** 首页背景图上限（与 API 侧一致）。 */
const MAX_BACKGROUNDS = 10;

/** 站点基本信息设置：文案、标识、首页背景（多图 / 视频）与内容区背景。 */
export function SiteSettingsManager({
  initial,
  images,
  videos,
}: {
  initial: SiteInfoRow;
  images: MediaOption[];
  videos: MediaOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [name, setName] = React.useState(initial.name);
  const [subtitle, setSubtitle] = React.useState(initial.subtitle);
  const [author, setAuthor] = React.useState(initial.author);
  const [description, setDescription] = React.useState(initial.description);
  const [logo, setLogo] = React.useState(initial.logo);
  const [favicon, setFavicon] = React.useState(initial.favicon);
  const [backgrounds, setBackgrounds] = React.useState<string[]>(initial.backgrounds);
  const [backgroundVideo, setBackgroundVideo] = React.useState(initial.backgroundVideo);
  const [pageBackground, setPageBackground] = React.useState(initial.pageBackground);
  const [postBackground, setPostBackground] = React.useState(initial.postBackground);
  const [icp, setIcp] = React.useState(initial.icp);
  const [icpLink, setIcpLink] = React.useState(initial.icpLink);

  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function updateBackground(index: number, next: string) {
    setBackgrounds((prev) => prev.map((item, i) => (i === index ? next : item)));
  }

  function addBackground() {
    setBackgrounds((prev) => (prev.length >= MAX_BACKGROUNDS ? prev : [...prev, ""]));
  }

  function removeBackground(index: number) {
    setBackgrounds((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBackground(index: number, delta: number) {
    setBackgrounds((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) {
        return prev;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subtitle,
          author,
          description,
          logo,
          favicon,
          // 空行直接丢弃，避免存下一堆空槽位
          backgrounds: backgrounds.filter((item) => item.trim().length > 0),
          backgroundVideo,
          pageBackground,
          postBackground,
          icp,
          icpLink,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(t("adminSite.failed", { message: payload?.error ?? "" }));
        return;
      }

      setMessage(t("adminSite.saved"));
      router.refresh();
    } catch {
      setError(t("adminSite.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5 surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{t("adminSite.title")}</h2>
        <Button
          type="button"
          size="sm"
          data-testid="site-save"
          className="press ripple"
          onClick={() => void save()}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <span className="loading-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          ) : (
            t("adminSite.save")
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("adminSite.hint")}</p>

      {/* 文案 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="site-name">{t("adminSite.name")}</Label>
          <Input
            id="site-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-author">{t("adminSite.author")}</Label>
          <Input
            id="site-author"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            maxLength={50}
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="site-subtitle">{t("adminSite.subtitle")}</Label>
          <Input
            id="site-subtitle"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">{t("adminSite.subtitleHint")}</p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="site-description">{t("adminSite.description")}</Label>
          <Textarea
            id="site-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            rows={2}
          />
        </div>
      </div>

      {/* 标识 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <MediaField
          id="site-logo"
          label={t("adminSite.logo")}
          hint={t("adminSite.logoHint")}
          value={logo}
          onChange={setLogo}
          options={images}
        />

        <MediaField
          id="site-favicon"
          label={t("adminSite.favicon")}
          hint={t("adminSite.faviconHint")}
          value={favicon}
          onChange={setFavicon}
          options={images}
        />
      </div>

      {/* 首页背景：多图轮播 + 视频 */}
      <div className="space-y-3 surface p-3">
        <div>
          <Label>{t("adminSite.background")}</Label>
          <p className="text-xs text-muted-foreground">{t("adminSite.backgroundHint")}</p>
        </div>

        {backgrounds.length === 0 ? (
          <p className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            {t("adminSite.noBackground")}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="site-backgrounds">
            {backgrounds.map((value, index) => (
              <li key={index} className="rounded border border-border/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("adminSite.backgroundIndex", { index: index + 1 })}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="press"
                      aria-label={t("adminSite.moveUp")}
                      disabled={index === 0}
                      onClick={() => moveBackground(index, -1)}
                    >
                      <ArrowUpIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="press"
                      aria-label={t("adminSite.moveDown")}
                      disabled={index === backgrounds.length - 1}
                      onClick={() => moveBackground(index, 1)}
                    >
                      <ArrowDownIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="press text-destructive"
                      aria-label={t("adminSite.removeBackground")}
                      onClick={() => removeBackground(index)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
                <MediaField
                  id={`site-background-${index}`}
                  label=""
                  value={value}
                  onChange={(next) => updateBackground(index, next)}
                  options={images}
                />
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="press"
          disabled={backgrounds.length >= MAX_BACKGROUNDS}
          onClick={addBackground}
        >
          <PlusIcon className="size-4" />
          {t("adminSite.addBackground")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("adminSite.backgroundListHint")}</p>

        <div className="border-t border-border/60 pt-3">
          <MediaField
            id="site-background-video"
            label={t("adminSite.backgroundVideo")}
            hint={t("adminSite.backgroundVideoHint")}
            value={backgroundVideo}
            onChange={setBackgroundVideo}
            options={videos}
            accept="video/*"
            preview="video"
          />
        </div>
      </div>

      {/* 内容区背景 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <MediaField
          id="site-page-background"
          label={t("adminSite.pageBackground")}
          hint={t("adminSite.pageBackgroundHint")}
          value={pageBackground}
          onChange={setPageBackground}
          options={images}
        />

        <MediaField
          id="site-post-background"
          label={t("adminSite.postBackground")}
          hint={t("adminSite.postBackgroundHint")}
          value={postBackground}
          onChange={setPostBackground}
          options={images}
        />
      </div>

      {/* 页脚备案信息：留空则页脚不显示备案区 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="site-icp">{t("adminSite.icp")}</Label>
          <Input
            id="site-icp"
            value={icp}
            onChange={(event) => setIcp(event.target.value)}
            maxLength={100}
            placeholder="京ICP备00000000号"
          />
          <p className="text-xs text-muted-foreground">{t("adminSite.icpHint")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-icp-link">{t("adminSite.icpLink")}</Label>
          <Input
            id="site-icp-link"
            value={icpLink}
            onChange={(event) => setIcpLink(event.target.value)}
            maxLength={500}
            placeholder="https://beian.miit.gov.cn/"
          />
          <p className="text-xs text-muted-foreground">{t("adminSite.icpLinkHint")}</p>
        </div>
      </div>

      {message ? (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
