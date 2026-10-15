"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { MediaField, type MediaOption } from "@/components/admin/media-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type VideoRow = {
  id: number;
  title: string;
  titleEn: string | null;
  cover: string | null;
  sourceType: string;
  srcUrl: string;
  description: string | null;
  published: boolean;
  pinned: boolean;
  sort: number;
};

const EMPTY = {
  title: "",
  titleEn: "",
  cover: "",
  sourceType: "local",
  srcUrl: "",
  description: "",
  published: false,
  pinned: false,
  sort: "0",
};

export function VideoManager({
  items,
  images,
  videos,
}: {
  items: VideoRow[];
  images: MediaOption[];
  videos: MediaOption[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [form, setForm] = React.useState(EMPTY);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        editingId === null ? "/api/admin/videos" : `/api/admin/videos/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            titleEn: form.titleEn.trim() || null,
            cover: form.cover.trim() || null,
            sourceType: form.sourceType,
            srcUrl: form.srcUrl.trim(),
            description: form.description.trim() || null,
            published: form.published,
            pinned: form.pinned,
            sort: Number(form.sort) || 0,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminVideos.failed", { message: payload?.error ?? "" }));
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("adminVideos.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: VideoRow) {
    if (!window.confirm(t("adminVideos.deleteConfirm", { title: item.title }))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/videos/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminVideos.failed", { message: payload?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("adminVideos.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("adminVideos.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 surface p-4 lg:grid-cols-4"
      >
        <div className="space-y-2">
          <Label htmlFor="video-title">{t("adminVideos.fieldTitle")}</Label>
          <Input
            id="video-title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            maxLength={200}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-title-en">{t("adminVideos.fieldTitleEn")}</Label>
          <Input
            id="video-title-en"
            value={form.titleEn}
            onChange={(event) => setForm({ ...form, titleEn: event.target.value })}
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("adminVideos.fieldSourceType")}</Label>
          <Select
            value={form.sourceType}
            onValueChange={(value) => setForm({ ...form, sourceType: value })}
          >
            <SelectTrigger id="video-source-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">{t("adminVideos.sourceLocal")}</SelectItem>
              <SelectItem value="iframe">{t("adminVideos.sourceIframe")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-sort">{t("adminVideos.fieldSort")}</Label>
          <Input
            id="video-sort"
            type="number"
            min={0}
            max={9999}
            value={form.sort}
            onChange={(event) => setForm({ ...form, sort: event.target.value })}
          />
        </div>

        {/*
          本地视频直接用媒体字段（可手填 / 上传 / 从媒体库挑）；
          外链 iframe 只能是网址，保持纯输入框。
        */}
        {form.sourceType === "local" ? (
          <div className="space-y-2 lg:col-span-2">
            <MediaField
              id="video-src"
              label={t("adminVideos.fieldSrcUrl")}
              hint={t("adminVideos.fieldSrcUrlHint")}
              value={form.srcUrl}
              onChange={(next) => setForm({ ...form, srcUrl: next })}
              options={videos}
              preview="video"
              accept="video/*"
            />
          </div>
        ) : (
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="video-src">{t("adminVideos.fieldSrcUrl")}</Label>
            <Input
              id="video-src"
              value={form.srcUrl}
              onChange={(event) => setForm({ ...form, srcUrl: event.target.value })}
              maxLength={1000}
              required
              placeholder="https://…"
            />
            <p className="text-xs text-muted-foreground">{t("adminVideos.fieldSrcUrlHint")}</p>
          </div>
        )}

        <div className="space-y-2 lg:col-span-2">
          <MediaField
            id="video-cover"
            label={t("adminVideos.fieldCover")}
            value={form.cover}
            onChange={(next) => setForm({ ...form, cover: next })}
            options={images}
          />
        </div>

        <div className="space-y-2 lg:col-span-4">
          <Label htmlFor="video-description">{t("adminVideos.fieldDescription")}</Label>
          <Textarea
            id="video-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={2000}
            rows={2}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label htmlFor="video-published" className="cursor-pointer">
            {t("adminVideos.fieldPublished")}
          </Label>
          <Switch
            id="video-published"
            checked={form.published}
            onCheckedChange={(value) => setForm({ ...form, published: value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label htmlFor="video-pinned" className="cursor-pointer">
            {t("adminVideos.fieldPinned")}
          </Label>
          <Switch
            id="video-pinned"
            checked={form.pinned}
            onCheckedChange={(value) => setForm({ ...form, pinned: value })}
          />
        </div>

        <div className="flex items-end gap-2 lg:col-span-2">
          <Button type="submit" disabled={pending}>
            {t("adminVideos.save")}
          </Button>
          {editingId !== null ? (
            <Button type="button" variant="outline" onClick={reset} disabled={pending}>
              {t("adminVideos.cancel")}
            </Button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("adminVideos.colTitle")}</TableHead>
              <TableHead className="w-32">{t("adminVideos.colSource")}</TableHead>
              <TableHead className="w-24">{t("adminVideos.colStatus")}</TableHead>
              <TableHead className="w-16 text-right">{t("adminVideos.fieldSort")}</TableHead>
              <TableHead className="w-36 text-right">{t("adminVideos.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="empty-state py-10 text-center text-muted-foreground">
                  {t("adminVideos.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.srcUrl}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.sourceType === "iframe"
                        ? t("adminVideos.sourceIframe")
                        : t("adminVideos.sourceLocal")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.published ? "default" : "outline"}>
                      {item.published ? t("adminVideos.published") : t("adminVideos.draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.sort}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            title: item.title,
                            titleEn: item.titleEn ?? "",
                            cover: item.cover ?? "",
                            sourceType: item.sourceType,
                            srcUrl: item.srcUrl,
                            description: item.description ?? "",
                            published: item.published,
                            pinned: item.pinned,
                            sort: String(item.sort),
                          });
                        }}
                      >
                        {t("adminVideos.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("adminVideos.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
