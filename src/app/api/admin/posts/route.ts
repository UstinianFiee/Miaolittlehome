import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import {
  createPost,
  listPosts,
  POST_LIST_PAGE_SIZE,
  type PostStatusFilter,
} from "@/lib/posts";
import { revalidatePost } from "@/lib/revalidate";
import {
  asBoolean,
  errorResponse,
  optionalInt,
  optionalString,
  parseTagNames,
  requireString,
} from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? POST_LIST_PAGE_SIZE) || POST_LIST_PAGE_SIZE)
  );

  const statusParam = url.searchParams.get("status");
  const status: PostStatusFilter =
    statusParam === "published" || statusParam === "draft" ? statusParam : "all";

  const categoryId = Number(url.searchParams.get("categoryId") ?? "") || null;
  const keyword = url.searchParams.get("q")?.trim() || null;

  const { total, items } = await listPosts({ page, pageSize, status, categoryId, keyword });

  return NextResponse.json({ ok: true, data: { items, total, page, pageSize } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const input = {
      title: requireString(body.title, "标题", { max: 200 }),
      slug: optionalString(body.slug, "slug", 200),
      summary: requireString(body.summary, "摘要", { max: 500 }),
      content: requireString(body.content, "正文", { max: 500_000 }),
      cover: optionalString(body.cover, "封面", 500),
      categoryId: optionalInt(body.categoryId, "分类"),
      tagNames: parseTagNames(body.tags),
      published: asBoolean(body.published),
      pinned: asBoolean(body.pinned),
    };

    const created = await createPost(input);
    revalidatePost(created.slug);
    await logOperation({ action: "post_create", target: created.slug, detail: input.title });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
