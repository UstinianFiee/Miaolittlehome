import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import NextLink from "next/link";

import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";
import { listCategories, listTags } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: catalogs.zh.posts.new,
};

export default async function NewPostPage() {
  const [categories, tags, images] = await Promise.all([
    listCategories(),
    listTags(),
    listMedia({ type: "image" }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <NextLink href="/admin/posts">
            <ArrowLeftIcon className="size-4" />
            {catalogs.zh.posts.backToList}
          </NextLink>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{catalogs.zh.posts.new}</h1>
      </div>

      <PostForm
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        knownTagNames={tags.map((tag) => tag.name)}
        coverImages={images.map((image) => ({
          id: image.id,
          path: image.path,
          title: image.title ?? image.path,
        }))}
      />
    </div>
  );
}
