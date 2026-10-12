"use client";

import { Trash2Icon, UploadIcon } from "lucide-react";
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
import { uploadFileInChunks } from "@/lib/client-upload";
import { formatBytes } from "@/lib/format";

export type SoftwareFileRow = {
  id: number;
  version: string;
  platform: string;
  fileName: string;
  fileSize: string;
  downloads: number;
};

export type SoftwareRow = {
  id: number;
  name: string;
  nameEn: string | null;
  icon: string | null;
  description: string;
  published: boolean;
  sort: number;
  files: SoftwareFileRow[];
};

const EMPTY = { name: "", nameEn: "", icon: "", description: "", published: false, sort: "0" };
const PLATFORMS = ["windows", "macos", "linux", "android", "ios"];

const PLATFORM_LABEL_KEYS: Record<string, string> = {
  windows: "software.platformWindows",
  macos: "software.platformMacos",
  linux: "software.platformLinux",
  android: "software.platformAndroid",
  ios: "software.platformIos",
};

export function SoftwareManager({ items }: { items: SoftwareRow[] }) {
  const t = useTranslations();
  const router = useRouter();

  const [form, setForm] = React.useState(EMPTY);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [managingId, setManagingId] = React.useState<number | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [version, setVersion] = React.useState("1.0.0");
  const [platform, setPlatform] = React.useState("windows");
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
        editingId === null ? "/api/admin/software" : `/api/admin/software/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            nameEn: form.nameEn.trim() || null,
            icon: form.icon.trim() || null,
            description: form.description,
            published: form.published,
            sort: Number(form.sort) || 0,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminSoftware.failed", { message: payload?.error ?? "" }));
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError(t("adminSoftware.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function remove(item: SoftwareRow) {
    if (!window.confirm(t("adminSoftware.deleteConfirm", { name: item.name }))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/software/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminSoftware.failed", { message: payload?.error ?? "" }));
        return;
      }
      if (editingId === item.id) {
        reset();
      }
      if (managingId === item.id) {
        setManagingId(null);
      }
      router.refresh();
    } catch {
      setError(t("adminSoftware.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  async function handleFile(files: FileList | null) {
    if (!files || files.length === 0 || managingId === null) {
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const result = await uploadFileInChunks(
          file,
          {
            init: "/api/admin/software/files/upload/init",
            chunk: "/api/admin/software/files/upload/chunk",
            complete: "/api/admin/software/files/upload/complete",
          },
          { softwareId: managingId, version, platform },
          setProgress
        );

        if (!result.ok) {
          setError(t("adminSoftware.uploadFailed", { message: result.message }));
          return;
        }
      }

      router.refresh();
    } catch {
      setError(t("adminSoftware.uploadFailed", { message: "" }));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function removeFile(file: SoftwareFileRow) {
    if (!window.confirm(t("adminSoftware.removeFileConfirm", { name: file.fileName }))) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/software/files/${file.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("adminSoftware.failed", { message: payload?.error ?? "" }));
        return;
      }
      router.refresh();
    } catch {
      setError(t("adminSoftware.failed", { message: "" }));
    } finally {
      setPending(false);
    }
  }

  const managing = items.find((item) => item.id === managingId) ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("adminSoftware.title")}</h1>

      <form
        onSubmit={submit}
        className="grid gap-3 surface p-4 lg:grid-cols-3"
      >
        <div className="space-y-2">
          <Label htmlFor="software-name">{t("adminSoftware.fieldName")}</Label>
          <Input
            id="software-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={100}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="software-name-en">{t("adminSoftware.fieldNameEn")}</Label>
          <Input
            id="software-name-en"
            value={form.nameEn}
            onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="software-icon">{t("adminSoftware.fieldIcon")}</Label>
          <Input
            id="software-icon"
            value={form.icon}
            onChange={(event) => setForm({ ...form, icon: event.target.value })}
            maxLength={500}
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="software-description">{t("adminSoftware.fieldDescription")}</Label>
          <Textarea
            id="software-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={2000}
            rows={2}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="software-sort">{t("adminSoftware.fieldSort")}</Label>
          <Input
            id="software-sort"
            type="number"
            min={0}
            max={9999}
            value={form.sort}
            onChange={(event) => setForm({ ...form, sort: event.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label htmlFor="software-published" className="cursor-pointer">
            {t("adminSoftware.fieldPublished")}
          </Label>
          <Switch
            id="software-published"
            checked={form.published}
            onCheckedChange={(value) => setForm({ ...form, published: value })}
          />
        </div>

        <div className="flex items-end gap-2 lg:col-span-2">
          <Button type="submit" disabled={pending}>
            {t("adminSoftware.save")}
          </Button>
          {editingId !== null ? (
            <Button type="button" variant="outline" onClick={reset} disabled={pending}>
              {t("adminSoftware.cancel")}
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
              <TableHead>{t("adminSoftware.colName")}</TableHead>
              <TableHead className="w-24 text-right">{t("adminSoftware.colFiles")}</TableHead>
              <TableHead className="w-24">{t("adminSoftware.colStatus")}</TableHead>
              <TableHead className="w-16 text-right">{t("adminSoftware.fieldSort")}</TableHead>
              <TableHead className="w-64 text-right">{t("adminSoftware.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="empty-state py-10 text-center text-muted-foreground">
                  {t("adminSoftware.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.files.length}</TableCell>
                  <TableCell>
                    <Badge variant={item.published ? "default" : "outline"}>
                      {item.published ? t("adminSoftware.published") : t("adminSoftware.draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.sort}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setManagingId(managingId === item.id ? null : item.id)}
                      >
                        {t("adminSoftware.files")}（{item.files.length}）
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            name: item.name,
                            nameEn: item.nameEn ?? "",
                            icon: item.icon ?? "",
                            description: item.description,
                            published: item.published,
                            sort: String(item.sort),
                          });
                        }}
                      >
                        {t("adminSoftware.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(item)}
                        disabled={pending}
                      >
                        {t("adminSoftware.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {managing ? (
        <div className="space-y-3 surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">
              {t("adminSoftware.files")} · {managing.name}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setManagingId(null)}>
              {t("adminSoftware.cancel")}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[8rem_10rem_auto]">
            <div className="space-y-2">
              <Label htmlFor="file-version">{t("adminSoftware.fileVersion")}</Label>
              <Input
                id="file-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("adminSoftware.filePlatform")}</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="file-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(PLATFORM_LABEL_KEYS[value])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void handleFile(event.target.files)}
              />
              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="size-4" />
                {uploading ? t("adminSoftware.uploading") : t("adminSoftware.addFile")}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t("adminSoftware.hint")}</p>

          {uploading ? (
            <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          ) : null}

          {managing.files.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("adminSoftware.noFiles")}
            </p>
          ) : (
            <div className="rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminSoftware.fileVersion")}</TableHead>
                    <TableHead className="w-28">{t("adminSoftware.filePlatform")}</TableHead>
                    <TableHead>{t("adminSoftware.fileName")}</TableHead>
                    <TableHead className="w-24 text-right">{t("adminSoftware.fileSize")}</TableHead>
                    <TableHead className="w-24 text-right">{t("adminSoftware.fileDownloads")}</TableHead>
                    <TableHead className="w-24 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managing.files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.version}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(PLATFORM_LABEL_KEYS[file.platform])}</Badge>
                      </TableCell>
                      <TableCell className="max-w-0 truncate text-sm">{file.fileName}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatBytes(file.fileSize)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {file.downloads}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("adminSoftware.removeFile")}
                          disabled={pending}
                          onClick={() => void removeFile(file)}
                        >
                          <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
