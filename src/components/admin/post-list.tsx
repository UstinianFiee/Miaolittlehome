"use client";

import { PlusIcon, PinIcon, SearchIcon, Trash2Icon } from "lucide-react";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export type PostListItem = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  pinned: boolean;
  views: number;
  categoryName: string | null;
  tagNames: string[];
  updatedAtLabel: string;
};

type PostListProps = {
  items: PostListItem[];
  categories: { id: number; name: string }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  status: string;
  categoryId: number | null;
  keyword: string | null;
};

const ALL = "all";

export function PostList({
  items,
  categories,
  total,
  page,
  totalPages,
  status,
  categoryId,
  keyword,
}: PostListProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [keywordInput, setKeywordInput] = React.useState(keyword ?? "");
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function buildHref(overrides: Record<string, string | null>): string {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  async function handleDelete(item: PostListItem) {
    if (!window.confirm(t("posts.deleteConfirm", { title: item.title }))) {
      return;
    }

    setDeletingId(item.id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/posts/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t("posts.deleteFailed", { message: data?.error ?? "" }));
        return;
      }
      router.refresh();
    } catch {
      setError(t("posts.deleteFailed", { message: "" }));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("posts.title")}</h1>
        <Button asChild size="sm">
          <NextLink href="/admin/posts/new">
            <PlusIcon className="size-4" />
            {t("posts.new")}
          </NextLink>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(buildHref({ q: keywordInput.trim() || null, page: null }));
          }}
        >
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={t("posts.searchPlaceholder")}
              className="w-56 pl-8"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            {t("posts.search")}
          </Button>
        </form>

        <Select
          value={status}
          onValueChange={(value) => router.push(buildHref({ status: value, page: null }))}
        >
          <SelectTrigger className="w-32" aria-label={t("posts.filterStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("posts.all")}</SelectItem>
            <SelectItem value="published">{t("posts.published")}</SelectItem>
            <SelectItem value="draft">{t("posts.draft")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryId === null ? ALL : String(categoryId)}
          onValueChange={(value) =>
            router.push(buildHref({ categoryId: value === ALL ? null : value, page: null }))
          }
        >
          <SelectTrigger className="w-36" aria-label={t("posts.filterCategory")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("posts.all")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground">
          {t("posts.total", { count: total })}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("posts.colTitle")}</TableHead>
              <TableHead className="w-28">{t("posts.colCategory")}</TableHead>
              <TableHead className="w-40">{t("posts.colTags")}</TableHead>
              <TableHead className="w-24">{t("posts.colStatus")}</TableHead>
              <TableHead className="w-20 text-right">{t("posts.colViews")}</TableHead>
              <TableHead className="w-56">{t("posts.colUpdated")}</TableHead>
              <TableHead className="w-32 text-right">{t("posts.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="empty-state py-10 text-center text-muted-foreground">
                  {t("posts.empty")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-0">
                    <div className="flex items-center gap-2">
                      {item.pinned ? (
                        <PinIcon
                          className="size-3.5 shrink-0 text-primary"
                          aria-label={t("posts.pinned")}
                        />
                      ) : null}
                      <span className="truncate font-medium">{item.title}</span>
                    </div>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.slug}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.categoryName ?? t("posts.uncategorized")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.tagNames.slice(0, 3).map((name) => (
                        <Badge key={name} variant="secondary">
                          {name}
                        </Badge>
                      ))}
                      {item.tagNames.length > 3 ? (
                        <Badge variant="outline">+{item.tagNames.length - 3}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.published ? "default" : "outline"}>
                      {item.published ? t("posts.published") : t("posts.draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.views}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {item.updatedAtLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <NextLink href={`/admin/posts/${item.id}`}>{t("posts.edit")}</NextLink>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("posts.delete")}
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item)}
                      >
                        <Trash2Icon className="trash-wiggle size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("posts.pageInfo", { page, totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(buildHref({ page: String(page - 1) }))}
            >
              {t("posts.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(buildHref({ page: String(page + 1) }))}
            >
              {t("posts.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
