"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { MediaField, type MediaOption } from "@/components/admin/media-field";
import { ICON_KEYS, iconLabel, isBrandIcon, ProfileIcon } from "@/components/site/profile-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ProfileLinkRow = { icon: string; label: string; url: string };

export type ProfileRow = {
  name: string;
  avatar: string;
  bio: string;
  links: ProfileLinkRow[];
};

const BRAND_KEYS = ICON_KEYS.filter(isBrandIcon);
const GENERIC_KEYS = ICON_KEYS.filter((key) => !isBrandIcon(key));

/** 图标选择器：品牌图标在前、通用图标在后。 */
function IconSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const t = useTranslations();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectGroup>
          <SelectLabel>{t("adminProfile.brandGroup")}</SelectLabel>
          {BRAND_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-2">
                <ProfileIcon name={key} className="size-4 shrink-0" />
                {iconLabel(key)}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>{t("adminProfile.genericGroup")}</SelectLabel>
          {GENERIC_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-2">
                <ProfileIcon name={key} className="size-4 shrink-0" />
                {iconLabel(key)}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** 关于页资料：显示名 / 头像 / 简介 / 自定义链接。 */
export function ProfileManager({
  initial,
  images,
}: {
  initial: ProfileRow;
  images: MediaOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [name, setName] = React.useState(initial.name);
  const [avatar, setAvatar] = React.useState(initial.avatar);
  const [bio, setBio] = React.useState(initial.bio);
  const [links, setLinks] = React.useState<ProfileLinkRow[]>(initial.links);

  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function updateLink(index: number, patch: Partial<ProfileLinkRow>) {
    setLinks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLink() {
    setLinks((prev) => [...prev, { icon: "github", label: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveLink(index: number, delta: number) {
    setLinks((prev) => {
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
      const response = await fetch("/api/admin/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          avatar,
          bio,
          // 地址为空的条目直接丢弃，避免存下一堆空行
          links: links.filter((link) => link.url.trim().length > 0),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(t("adminProfile.failed", { message: payload?.error ?? "" }));
        return;
      }

      setMessage(t("adminProfile.saved"));
      router.refresh();
    } catch {
      setError(t("adminProfile.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5 surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{t("adminProfile.title")}</h2>
        <Button
          type="button"
          size="sm"
          data-testid="profile-save"
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
            t("adminProfile.save")
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("adminProfile.hint")}</p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">{t("adminProfile.name")}</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            placeholder={t("adminProfile.namePlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("adminProfile.nameHint")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-bio">{t("adminProfile.bio")}</Label>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={1000}
            rows={2}
          />
        </div>
      </div>

      <MediaField
        id="profile-avatar"
        label={t("adminProfile.avatar")}
        hint={t("adminProfile.avatarHint")}
        value={avatar}
        onChange={setAvatar}
        options={images}
      />

      {/* 自定义链接 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label>{t("adminProfile.links")}</Label>
            <p className="text-xs text-muted-foreground">{t("adminProfile.linksHint")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="press" onClick={addLink}>
            <PlusIcon className="size-4" />
            {t("adminProfile.addLink")}
          </Button>
        </div>

        {links.length === 0 ? (
          <p className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            {t("adminProfile.noLinks")}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="profile-links">
            {links.map((link, index) => (
              <li
                key={index}
                className="grid gap-2 rounded border border-border/60 p-3 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,1.4fr)_auto]"
              >
                <IconSelect
                  value={link.icon}
                  onChange={(next) => updateLink(index, { icon: next })}
                  ariaLabel={t("adminProfile.icon")}
                />

                <Input
                  value={link.label}
                  onChange={(event) => updateLink(index, { label: event.target.value })}
                  maxLength={40}
                  placeholder={t("adminProfile.linkLabel")}
                  aria-label={t("adminProfile.linkLabel")}
                />

                <Input
                  value={link.url}
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                  maxLength={500}
                  placeholder="https://…"
                  aria-label={t("adminProfile.linkUrl")}
                />

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="press"
                    aria-label={t("adminProfile.moveUp")}
                    disabled={index === 0}
                    onClick={() => moveLink(index, -1)}
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="press"
                    aria-label={t("adminProfile.moveDown")}
                    disabled={index === links.length - 1}
                    onClick={() => moveLink(index, 1)}
                  >
                    <ArrowDownIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="press text-destructive"
                    aria-label={t("adminProfile.removeLink")}
                    onClick={() => removeLink(index)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
