"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DualTime } from "@/components/site/dual-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export type AnnouncementRow = {
  id: number;
  content: string;
  pinned: boolean;
  published: boolean;
  createdAt: string;
};

const EMPTY = { content: "", pinned: false, published: true };

export function AnnouncementManager({ items }: { items: AnnouncementRow[] }) {
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
        editingId === null ? "/api/admin/announcements" : `/api/admin/announcements/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminAnnouncements.failed", { message: payload?.error ?? "" }));
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("adminAnnouncements.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: AnnouncementRow) {
    if (!window.confirm(t("adminAnnouncements.deleteConfirm"))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/announcements/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminAnnouncements.failed", { message: payload?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("adminAnnouncements.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("adminAnnouncements.title")}</h1>

      <form onSubmit={submit} className="space-y-3 surface p-4">
        <div className="space-y-2">
          <Label htmlFor="announcement-content">{t("adminAnnouncements.fieldContent")}</Label>
          <Textarea
            id="announcement-content"
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            maxLength={500}
            rows={3}
            required
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Label htmlFor="announcement-pinned" className="cursor-pointer">
              {t("adminAnnouncements.fieldPinned")}
            </Label>
            <Switch
              id="announcement-pinned"
              checked={form.pinned}
              onCheckedChange={(value) => setForm({ ...form, pinned: value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="announcement-published" className="cursor-pointer">
              {t("adminAnnouncements.fieldPublished")}
            </Label>
            <Switch
              id="announcement-published"
              checked={form.published}
              onCheckedChange={(value) => setForm({ ...form, published: value })}
            />
          </div>

          <div className="ml-auto flex gap-2">
            <Button type="submit" disabled={pending}>
              {t("adminAnnouncements.save")}
            </Button>
            {editingId !== null ? (
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                {t("adminAnnouncements.cancel")}
              </Button>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("adminAnnouncements.hint")}</p>
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
              <TableHead>{t("adminAnnouncements.colContent")}</TableHead>
              <TableHead className="w-28">{t("adminAnnouncements.colStatus")}</TableHead>
              <TableHead className="w-56">{t("adminAnnouncements.colTime")}</TableHead>
              <TableHead className="w-36 text-right">{t("adminAnnouncements.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="empty-state py-10 text-center text-muted-foreground">
                  {t("adminAnnouncements.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-0">
                    <p className="truncate text-sm" title={item.content}>
                      {item.content}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={item.published ? "default" : "outline"}>
                        {item.published
                          ? t("adminAnnouncements.published")
                          : t("adminAnnouncements.hidden")}
                      </Badge>
                      {item.pinned ? (
                        <Badge variant="secondary">{t("adminAnnouncements.fieldPinned")}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <DualTime date={item.createdAt} variant="stacked" />
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
                            pinned: item.pinned,
                            published: item.published,
                          });
                        }}
                      >
                        {t("adminAnnouncements.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("adminAnnouncements.delete")}
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
