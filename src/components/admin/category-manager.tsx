"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CategoryRow = {
  id: number;
  name: string;
  nameEn: string | null;
  type: string;
  sort: number;
  postCount: number;
};

const TYPE_KEYS: Record<string, string> = {
  post: "categories.typePost",
  video: "categories.typeVideo",
  software: "categories.typeSoftware",
};

const EMPTY_FORM = { name: "", nameEn: "", type: "post", sort: "0" };

export function CategoryManager({ items }: { items: CategoryRow[] }) {
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
        editingId === null ? "/api/admin/categories" : `/api/admin/categories/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            nameEn: form.nameEn.trim() || null,
            type: form.type,
            sort: Number(form.sort) || 0,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(
          t(editingId === null ? "categories.createFailed" : "categories.updateFailed", {
            message: data?.error ?? "",
          })
        );
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("categories.updateFailed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: CategoryRow) {
    if (!window.confirm(t("categories.deleteConfirm", { name: item.name }))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("categories.deleteFailed", { message: data?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      router.refresh();
    } catch {
      setError(t("categories.deleteFailed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("categories.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 surface p-4 sm:grid-cols-[1fr_1fr_9rem_6rem_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="category-name">{t("categories.name")}</Label>
          <Input
            id="category-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={50}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-name-en">{t("categories.nameEn")}</Label>
          <Input
            id="category-name-en"
            value={form.nameEn}
            onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-type">{t("categories.type")}</Label>
          <Select
            value={form.type}
            onValueChange={(value) => setForm({ ...form, type: value })}
          >
            <SelectTrigger id="category-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="post">{t("categories.typePost")}</SelectItem>
              <SelectItem value="video">{t("categories.typeVideo")}</SelectItem>
              <SelectItem value="software">{t("categories.typeSoftware")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-sort">{t("categories.sort")}</Label>
          <Input
            id="category-sort"
            type="number"
            min={0}
            max={9999}
            value={form.sort}
            onChange={(event) => setForm({ ...form, sort: event.target.value })}
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" disabled={pending}>
            {t("categories.save")}
          </Button>
          {editingId !== null ? (
            <Button type="button" variant="outline" onClick={reset} disabled={pending}>
              {t("categories.cancel")}
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
              <TableHead>{t("categories.name")}</TableHead>
              <TableHead>{t("categories.nameEn")}</TableHead>
              <TableHead className="w-24">{t("categories.type")}</TableHead>
              <TableHead className="w-20 text-right">{t("categories.sort")}</TableHead>
              <TableHead className="w-24 text-right">{t("categories.postCount")}</TableHead>
              <TableHead className="w-32 text-right">{t("categories.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="empty-state py-10 text-center text-muted-foreground">
                  {t("categories.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.nameEn ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(TYPE_KEYS[item.type] ?? item.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.sort}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.postCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            name: item.name,
                            nameEn: item.nameEn ?? "",
                            type: item.type,
                            sort: String(item.sort),
                          });
                        }}
                      >
                        {t("categories.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("categories.delete")}
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
