import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { deletePost, getPostForEdit, updatePost } from "@/lib/posts";
import { revalidatePost } from "@/lib/revalidate";
import {
  asBoolean,
  errorResponse,
  optionalInt,
  optionalString,
  parseTagNames,
  requireString,
} from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的文章 id" }, { status: 400 });
  }

  const post = await getPostForEdit(id);
  if (!post) {
    return NextResponse.json({ ok: false, error: "文章不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: post });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的文章 id" }, { status: 400 });
  }

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

    const result = await updatePost(id, input);
    if (!result) {
      return NextResponse.json({ ok: false, error: "文章不存在" }, { status: 404 });
    }

    revalidatePost(result.updated.slug, result.previousSlug);
    await logOperation({
      action: "post_update",
      target: result.updated.slug,
      detail: input.title,
    });

    return NextResponse.json({ ok: true, data: result.updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的文章 id" }, { status: 400 });
  }

  const deleted = await deletePost(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "文章不存在" }, { status: 404 });
  }

  revalidatePost(null, deleted.slug);
  await logOperation({ action: "post_delete", target: deleted.slug, detail: deleted.title });

  return NextResponse.json({ ok: true, data: { id } });
}
