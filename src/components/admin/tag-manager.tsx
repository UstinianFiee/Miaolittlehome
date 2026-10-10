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

export type TagRow = {
  id: number;
  name: string;
  slug: string;
  postCount: number;
};

export function TagManager({ items }: { items: TagRow[] }) {
  const t = useTranslations();
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setName("");
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
        editingId === null ? "/api/admin/tags" : `/api/admin/tags/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(
          t(editingId === null ? "tags.createFailed" : "tags.updateFailed", {
            message: data?.error ?? "",
          })
        );
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("tags.updateFailed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: TagRow) {
    if (
      !window.confirm(
        t("tags.deleteConfirm", { name: item.name, count: item.postCount })
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tags/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("tags.deleteFailed", { message: data?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("tags.deleteFailed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("tags.title")}</h1>

      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 surface p-4"
      >
        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor="tag-name">{t("tags.name")}</Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={30}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {t("tags.save")}
        </Button>
        {editingId !== null ? (
          <Button type="button" variant="outline" onClick={reset} disabled={pending}>
            {t("tags.cancel")}
          </Button>
        ) : null}
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
              <TableHead>{t("tags.name")}</TableHead>
              <TableHead>{t("tags.slug")}</TableHead>
              <TableHead className="w-24 text-right">{t("tags.postCount")}</TableHead>
              <TableHead className="w-32 text-right">{t("tags.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {t("tags.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.postCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setName(item.name);
                        }}
                      >
                        {t("tags.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("tags.delete")}
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
