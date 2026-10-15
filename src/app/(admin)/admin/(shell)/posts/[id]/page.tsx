import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import NextLink from "next/link";

import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";
import { getPostForEdit } from "@/lib/posts";
import { listCategories, listTags } from "@/lib/taxonomy";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: catalogs.zh.posts.edit,
};

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const postId = Number(id);

  const post = Number.isInteger(postId) && postId > 0 ? await getPostForEdit(postId) : null;

  if (!post) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{catalogs.zh.posts.notFound}</h1>
        <Button asChild variant="outline" size="sm">
          <NextLink href="/admin/posts">
            <ArrowLeftIcon className="size-4" />
            {catalogs.zh.posts.backToList}
          </NextLink>
        </Button>
      </div>
    );
  }

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
        <h1 className="text-xl font-semibold tracking-tight">{catalogs.zh.posts.edit}</h1>
      </div>

      <PostForm
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        knownTagNames={tags.map((tag) => tag.name)}
        coverImages={images.map((image) => ({
          id: image.id,
          path: image.path,
          title: image.title ?? image.path,
        }))}
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          summary: post.summary,
          content: post.content,
          cover: post.cover,
          categoryId: post.categoryId,
          tagNames: post.tags.map((entry) => entry.tag.name),
          published: post.published,
          pinned: post.pinned,
        }}
      />
    </div>
  );
}
