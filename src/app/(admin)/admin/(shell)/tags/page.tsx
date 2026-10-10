import type { Metadata } from "next";

import { TagManager } from "@/components/admin/tag-manager";
import { catalogs } from "@/lib/messages";
import { listTags } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: catalogs.zh.tags.title,
};

export default async function AdminTagsPage() {
  const tags = await listTags();

  return (
    <TagManager
      items={tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        postCount: tag._count.posts,
      }))}
    />
  );
}
