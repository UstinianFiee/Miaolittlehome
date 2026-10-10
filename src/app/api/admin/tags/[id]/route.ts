import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateTaxonomy } from "@/lib/revalidate";
import { deleteTag, findTagByName, updateTag } from "@/lib/taxonomy";
import { errorResponse, requireString } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的标签 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = requireString(body.name, "标签名", { max: 30 });

    const duplicate = await findTagByName(name);
    if (duplicate && duplicate.id !== id) {
      return NextResponse.json({ ok: false, error: "同名标签已存在" }, { status: 409 });
    }

    const updated = await updateTag(id, name);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "标签不存在" }, { status: 404 });
    }

    revalidateTaxonomy();
    await logOperation({ action: "tag_update", target: updated.name });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的标签 id" }, { status: 400 });
  }

  const deleted = await deleteTag(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "标签不存在" }, { status: 404 });
  }

  revalidateTaxonomy();
  await logOperation({
    action: "tag_delete",
    target: deleted.name,
    detail: `解除与 ${deleted._count.posts} 篇文章的关联`,
  });

  return NextResponse.json({ ok: true, data: { id } });
}
