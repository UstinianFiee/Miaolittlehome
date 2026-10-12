"use client";

import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export type AlbumRow = {
  id: number;
  name: string;
  nameEn: string | null;
  cover: string | null;
  description: string | null;
  sort: number;
  photoCount: number;
};

const EMPTY_FORM = { name: "", nameEn: "", description: "", cover: "", sort: "0" };

export function AlbumManager({ items }: { items: AlbumRow[] }) {
  const t = useTranslations();
  const router = useRouter();

  const [form, setForm] = React.useState(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setForm(EMPTY_FORM);
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
        editingId === null ? "/api/admin/albums" : `/api/admin/albums/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            nameEn: form.nameEn.trim() || null,
            description: form.description.trim() || null,
            cover: form.cover.trim() || null,
            sort: Number(form.sort) || 0,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(
          t(editingId === null ? "albums.createFailed" : "albums.updateFailed", {
            message: payload?.error ?? "",
          })
        );
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("albums.updateFailed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: AlbumRow) {
    if (!window.confirm(t("albums.deleteConfirm", { name: item.name }))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/albums/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("albums.deleteFailed", { message: payload?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("albums.deleteFailed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("albums.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 surface p-4 lg:grid-cols-[1fr_1fr_6rem_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="album-name">{t("albums.name")}</Label>
          <Input
            id="album-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={50}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="album-name-en">{t("albums.nameEn")}</Label>
          <Input
            id="album-name-en"
            value={form.nameEn}
            onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="album-sort">{t("albums.sort")}</Label>
          <Input
            id="album-sort"
            type="number"
            min={0}
            max={9999}
            value={form.sort}
            onChange={(event) => setForm({ ...form, sort: event.target.value })}
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" disabled={pending}>
            {t("albums.save")}
          </Button>
          {editingId !== null ? (
            <Button type="button" variant="outline" onClick={reset} disabled={pending}>
              {t("albums.cancel")}
            </Button>
          ) : null}
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="album-description">{t("albums.description")}</Label>
          <Textarea
            id="album-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={500}
            rows={2}
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="album-cover">{t("albums.cover")}</Label>
          <Input
            id="album-cover"
            value={form.cover}
            onChange={(event) => setForm({ ...form, cover: event.target.value })}
            maxLength={500}
            placeholder="/media/2026/10/xxx.thumb.webp"
          />
          <p className="text-xs text-muted-foreground">{t("albums.coverHint")}</p>
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
              <TableHead className="w-20">{t("albums.cover")}</TableHead>
              <TableHead>{t("albums.name")}</TableHead>
              <TableHead className="w-24 text-right">{t("albums.photoCount")}</TableHead>
              <TableHead className="w-16 text-right">{t("albums.sort")}</TableHead>
              <TableHead className="w-64 text-right">{t("albums.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="empty-state py-10 text-center text-muted-foreground">
                  {t("albums.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.cover}
                        alt=""
                        className="size-10 rounded border border-border/60 object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    {item.nameEn ? (
                      <span className="ml-2 text-xs text-muted-foreground">{item.nameEn}</span>
                    ) : null}
                    {item.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.photoCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.sort}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <NextLink href={`/admin/media?album=${item.id}`}>
                          {t("albums.managePhotos")}
                        </NextLink>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            name: item.name,
                            nameEn: item.nameEn ?? "",
                            description: item.description ?? "",
                            cover: item.cover ?? "",
                            sort: String(item.sort),
                          });
                        }}
                      >
                        {t("albums.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("albums.delete")}
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
