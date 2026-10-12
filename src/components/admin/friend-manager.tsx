"use client";

import { useRouter } from "next/navigation";
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

export type FriendRow = {
  id: number;
  name: string;
  url: string;
  avatar: string | null;
  description: string | null;
  sort: number;
};

const EMPTY = { name: "", url: "", avatar: "", description: "", sort: "0" };

export function FriendManager({ items }: { items: FriendRow[] }) {
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
        editingId === null ? "/api/admin/friends" : `/api/admin/friends/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            url: form.url.trim(),
            avatar: form.avatar.trim() || null,
            description: form.description.trim() || null,
            sort: Number(form.sort) || 0,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminFriends.failed", { message: payload?.error ?? "" }));
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("adminFriends.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: FriendRow) {
    if (!window.confirm(t("adminFriends.deleteConfirm", { name: item.name }))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/friends/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminFriends.failed", { message: payload?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("adminFriends.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("adminFriends.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 surface p-4 lg:grid-cols-5"
      >
        <div className="space-y-2">
          <Label htmlFor="friend-name">{t("adminFriends.fieldName")}</Label>
          <Input
            id="friend-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={100}
            required
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="friend-url">{t("adminFriends.fieldUrl")}</Label>
          <Input
            id="friend-url"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            maxLength={500}
            required
            placeholder="https://"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="friend-avatar">{t("adminFriends.fieldAvatar")}</Label>
          <Input
            id="friend-avatar"
            value={form.avatar}
            onChange={(event) => setForm({ ...form, avatar: event.target.value })}
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="friend-sort">{t("adminFriends.fieldSort")}</Label>
          <Input
            id="friend-sort"
            type="number"
            min={0}
            max={9999}
            value={form.sort}
            onChange={(event) => setForm({ ...form, sort: event.target.value })}
          />
        </div>

        <div className="space-y-2 lg:col-span-3">
          <Label htmlFor="friend-description">{t("adminFriends.fieldDescription")}</Label>
          <Input
            id="friend-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={300}
          />
        </div>

        <div className="flex items-end gap-2 lg:col-span-2">
          <Button type="submit" disabled={pending}>
            {t("adminFriends.save")}
          </Button>
          {editingId !== null ? (
            <Button type="button" variant="outline" onClick={reset} disabled={pending}>
              {t("adminFriends.cancel")}
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground lg:col-span-5">{t("adminFriends.hint")}</p>
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
              <TableHead className="w-16">{t("adminFriends.fieldAvatar")}</TableHead>
              <TableHead>{t("adminFriends.colName")}</TableHead>
              <TableHead>{t("adminFriends.colUrl")}</TableHead>
              <TableHead className="w-16 text-right">{t("adminFriends.fieldSort")}</TableHead>
              <TableHead className="w-36 text-right">{t("adminFriends.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="empty-state py-10 text-center text-muted-foreground">
                  {t("adminFriends.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.avatar}
                        alt=""
                        className="size-8 rounded-full border border-border/60 object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    {item.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-0 truncate text-sm text-muted-foreground">
                    {item.url}
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
                            name: item.name,
                            url: item.url,
                            avatar: item.avatar ?? "",
                            description: item.description ?? "",
                            sort: String(item.sort),
                          });
                        }}
                      >
                        {t("adminFriends.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("adminFriends.delete")}
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
