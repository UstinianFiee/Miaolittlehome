"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { MediaField, type MediaOption } from "@/components/admin/media-field";
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
import { Textarea } from "@/components/ui/textarea";

export type PostFormInitial = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover: string | null;
  categoryId: number | null;
  tagNames: string[];
  published: boolean;
  pinned: boolean;
};

type PostFormProps = {
  categories: { id: number; name: string }[];
  knownTagNames: string[];
  coverImages: MediaOption[];
  initial?: PostFormInitial;
};

const NO_CATEGORY = "none";

export function PostForm({ categories, knownTagNames, coverImages, initial }: PostFormProps) {
  const t = useTranslations();
  const router = useRouter();

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [slug, setSlug] = React.useState(initial?.slug ?? "");
  const [summary, setSummary] = React.useState(initial?.summary ?? "");
  const [content, setContent] = React.useState(initial?.content ?? "");
  const [cover, setCover] = React.useState(initial?.cover ?? "");
  const [categoryId, setCategoryId] = React.useState(
    initial?.categoryId ? String(initial.categoryId) : NO_CATEGORY
  );
  const [tagInput, setTagInput] = React.useState((initial?.tagNames ?? []).join(", "));
  const [published, setPublished] = React.useState(initial?.published ?? false);
  const [pinned, setPinned] = React.useState(initial?.pinned ?? false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // 封面正在上传时不允许提交，否则会保存旧路径
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const uploadingBusy = uploadingCount > 0;

  const handleMediaBusy = React.useCallback((busy: boolean) => {
    setUploadingCount((count) => (busy ? count + 1 : Math.max(0, count - 1)));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploadingBusy) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        initial ? `/api/admin/posts/${initial.id}` : "/api/admin/posts",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            slug: slug.trim() || null,
            summary,
            content,
            cover: cover.trim() || null,
            categoryId: categoryId === NO_CATEGORY ? null : Number(categoryId),
            tags: tagInput,
            published,
            pinned,
          }),
        }
      );

      if (response.ok) {
        router.push("/admin/posts");
        router.refresh();
        return;
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(t("posts.saveFailed", { message: data?.error ?? t("posts.loadFailed") }));
    } catch {
      setError(t("posts.saveFailed", { message: t("posts.loadFailed") }));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("posts.fieldTitle")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">{t("posts.fieldSummary")}</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={500}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label id="post-content-label">{t("posts.fieldContent")}</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder={t("posts.editorPlaceholder")}
              ariaLabelledBy="post-content-label"
            />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slug">{t("posts.fieldSlug")}</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              maxLength={200}
              placeholder="hello-world"
            />
            <p className="text-xs text-muted-foreground">{t("posts.fieldSlugHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-category">{t("posts.fieldCategory")}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="post-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>{t("posts.uncategorized")}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">{t("posts.fieldTags")}</Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              list="known-tags"
            />
            <datalist id="known-tags">
              {knownTagNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">{t("posts.fieldTagsHint")}</p>
          </div>

          <MediaField
            id="cover"
            label={t("posts.fieldCover")}
            value={cover}
            onChange={setCover}
            options={coverImages}
            onBusyChange={handleMediaBusy}
          />

          <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
            <Label htmlFor="published" className="cursor-pointer">
              {t("posts.fieldPublished")}
            </Label>
            <Switch id="published" checked={published} onCheckedChange={setPublished} />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
            <Label htmlFor="pinned" className="cursor-pointer">
              {t("posts.fieldPinned")}
            </Label>
            <Switch id="pinned" checked={pinned} onCheckedChange={setPinned} />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || uploadingBusy}>
              {pending ? t("posts.saving") : t("posts.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/posts")}
              disabled={pending}
            >
              {t("posts.cancel")}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}
