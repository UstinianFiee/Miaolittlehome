import type { Metadata } from "next";

import { PostList, type PostListItem } from "@/components/admin/post-list";
import { catalogs } from "@/lib/messages";
import { listPosts, POST_LIST_PAGE_SIZE, type PostStatusFilter } from "@/lib/posts";
import { listCategories } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: catalogs.zh.posts.title,
};

type SearchParams = Promise<{
  page?: string;
  status?: string;
  categoryId?: string;
  q?: string;
}>;

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const requestedPage = Math.max(1, Number(params.page ?? "1") || 1);
  const statusParam = params.status;
  const status: PostStatusFilter =
    statusParam === "published" || statusParam === "draft" ? statusParam : "all";
  const categoryId = Number(params.categoryId ?? "") || null;
  const keyword = params.q?.trim() || null;

  const [firstPage, categories] = await Promise.all([
    listPosts({
      page: requestedPage,
      pageSize: POST_LIST_PAGE_SIZE,
      status,
      categoryId,
      keyword,
    }),
    listCategories(),
  ]);

  // 删除最后一页的文章、或手改 URL 后，把页码夹回有效范围，避免停在空列表
  const totalPages = Math.max(1, Math.ceil(firstPage.total / POST_LIST_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const { items, total } =
    page === requestedPage
      ? firstPage
      : await listPosts({ page, pageSize: POST_LIST_PAGE_SIZE, status, categoryId, keyword });

  const listItems: PostListItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    published: item.published,
    pinned: item.pinned,
    views: item.views,
    categoryName: item.category?.name ?? null,
    tagNames: item.tags.map((entry) => entry.tag.name),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <PostList
      items={listItems}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      total={total}
      page={page}
      pageSize={POST_LIST_PAGE_SIZE}
      totalPages={totalPages}
      status={status}
      categoryId={categoryId}
      keyword={keyword}
    />
  );
}
