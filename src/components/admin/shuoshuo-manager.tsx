"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { MediaField, type MediaOption } from "@/components/admin/media-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDual } from "@/lib/datetime";

export type ShuoshuoRow = {
  id: number;
  content: string;
  contentEn: string | null;
  images: string[];
  location: string | null;
  pinned: boolean;
  published: boolean;
  createdAt: string;
};

/** 配图上限（与 API / 前台一致，九宫格）。 */
const MAX_IMAGES = 9;

const EMPTY = {
  content: "",
  contentEn: "",
  images: [] as string[],
  location: "",
  pinned: false,
  published: true,
};

export function ShuoshuoManager({
  items,
  images,
}: {
  items: ShuoshuoRow[];
  images: MediaOption[];
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
        editingId === null ? "/api/admin/shuoshuo" : `/api/admin/shuoshuo/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: form.content,
            contentEn: form.contentEn.trim() || null,
            images: form.images.filter((item) => item.trim().length > 0),
            location: form.location.trim() || null,
            pinned: form.pinned,
            published: form.published,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminShuoshuo.failed", { message: payload?.error ?? "" }));
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("adminShuoshuo.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: ShuoshuoRow) {
    if (!window.confirm(t("adminShuoshuo.deleteConfirm"))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/shuoshuo/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminShuoshuo.failed", { message: payload?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("adminShuoshuo.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  function updateImage(index: number, next: string) {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((item, i) => (i === index ? next : item)),
    }));
  }

  function moveImage(index: number, delta: number) {
    setForm((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.images.length) {
        return prev;
      }
      const next = [...prev.images];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, images: next };
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("adminShuoshuo.title")}</h1>

      <form onSubmit={submit} className="space-y-4 surface p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shuoshuo-content">{t("adminShuoshuo.fieldContent")}</Label>
            <Textarea
              id="shuoshuo-content"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              maxLength={2000}
              rows={5}
              required
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shuoshuo-content-en">{t("adminShuoshuo.fieldContentEn")}</Label>
              <Textarea
                id="shuoshuo-content-en"
                value={form.contentEn}
                onChange={(event) => setForm({ ...form, contentEn: event.target.value })}
                maxLength={2000}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shuoshuo-location">{t("adminShuoshuo.fieldLocation")}</Label>
              <Input
                id="shuoshuo-location"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                maxLength={50}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("adminShuoshuo.fieldImages")}</Label>
          <p className="text-xs text-muted-foreground">{t("adminShuoshuo.fieldImagesHint")}</p>

          <div className="space-y-3">
            {form.images.map((value, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <MediaField
                    id={`shuoshuo-image-${index}`}
                    label={`#${index + 1}`}
                    value={value}
                    onChange={(next) => updateImage(index, next)}
                    options={images}
                  />
                </div>
                <div className="flex shrink-0 gap-1 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="上移"
                    disabled={index === 0}
                    onClick={() => moveImage(index, -1)}
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="下移"
                    disabled={index === form.images.length - 1}
                    onClick={() => moveImage(index, 1)}
                  >
                    <ArrowDownIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("adminShuoshuo.delete")}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.images.length >= MAX_IMAGES}
            onClick={() => setForm((prev) => ({ ...prev, images: [...prev.images, ""] }))}
          >
            <PlusIcon className="size-4" />
            {t("adminShuoshuo.fieldImages")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Label htmlFor="shuoshuo-pinned" className="cursor-pointer">
              {t("adminShuoshuo.fieldPinned")}
            </Label>
            <Switch
              id="shuoshuo-pinned"
              checked={form.pinned}
              onCheckedChange={(value) => setForm({ ...form, pinned: value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="shuoshuo-published" className="cursor-pointer">
              {t("adminShuoshuo.fieldPublished")}
            </Label>
            <Switch
              id="shuoshuo-published"
              checked={form.published}
              onCheckedChange={(value) => setForm({ ...form, published: value })}
            />
          </div>

          <div className="ml-auto flex gap-2">
            <Button type="submit" disabled={pending}>
              {t("adminShuoshuo.save")}
            </Button>
            {editingId !== null ? (
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                {t("adminShuoshuo.cancel")}
              </Button>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("adminShuoshuo.hint")}</p>
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
              <TableHead>{t("adminShuoshuo.colContent")}</TableHead>
              <TableHead className="w-32">{t("adminShuoshuo.colStatus")}</TableHead>
              <TableHead className="w-56">{t("adminShuoshuo.colTime")}</TableHead>
              <TableHead className="w-36 text-right">{t("adminShuoshuo.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="empty-state py-10 text-center text-muted-foreground">
                  {t("adminShuoshuo.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-0">
                    <p className="truncate text-sm" title={item.content}>
                      {item.content}
                    </p>
                    {item.location ? (
                      <p className="truncate text-xs text-muted-foreground">{item.location}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={item.published ? "default" : "outline"}>
                        {item.published
                          ? t("adminShuoshuo.published")
                          : t("adminShuoshuo.hidden")}
                      </Badge>
                      {item.pinned ? (
                        <Badge variant="secondary">{t("adminShuoshuo.fieldPinned")}</Badge>
                      ) : null}
                      {item.images.length > 0 ? (
                        <Badge variant="secondary">
                          {t("adminShuoshuo.imageCount", { count: item.images.length })}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDual(new Date(item.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            content: item.content,
                            contentEn: item.contentEn ?? "",
                            images: item.images,
                            location: item.location ?? "",
                            pinned: item.pinned,
                            published: item.published,
                          });
                        }}
                      >
                        {t("adminShuoshuo.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("adminShuoshuo.delete")}
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
