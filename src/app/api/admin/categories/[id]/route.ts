import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateTaxonomy } from "@/lib/revalidate";
import {
  deleteCategory,
  isCategoryType,
  normalizeSort,
  updateCategory,
} from "@/lib/taxonomy";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的分类 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const type = requireString(body.type, "类型", { max: 20 });
    if (!isCategoryType(type)) {
      return NextResponse.json(
        { ok: false, error: "类型只能是 post / video / software" },
        { status: 400 }
      );
    }

    const updated = await updateCategory(id, {
      name: requireString(body.name, "名称", { max: 50 }),
      nameEn: optionalString(body.nameEn, "英文名", 50),
      type,
      sort: normalizeSort(body.sort),
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "分类不存在" }, { status: 404 });
    }

    revalidateTaxonomy();
    await logOperation({ action: "category_update", target: updated.name });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的分类 id" }, { status: 400 });
  }

  const deleted = await deleteCategory(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "分类不存在" }, { status: 404 });
  }

  revalidateTaxonomy();
  await logOperation({
    action: "category_delete",
    target: deleted.name,
    detail: `原属文章 ${deleted._count.posts} 篇（已置为未分类）`,
  });

  return NextResponse.json({ ok: true, data: { id } });
}
