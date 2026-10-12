import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateShuoshuo } from "@/lib/revalidate";
import { deleteShuoshuo, updateShuoshuo, SHUOSHUO_MAX_IMAGES } from "@/lib/shuoshuo";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, SHUOSHUO_MAX_IMAGES);
}

function serialize(item: NonNullable<Awaited<ReturnType<typeof updateShuoshuo>>>) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的说说 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const updated = await updateShuoshuo(id, {
      content: requireString(body.content, "说说内容", { max: 2000 }),
      contentEn: optionalString(body.contentEn, "英文内容", 2000),
      images: parseImages(body.images),
      location: optionalString(body.location, "地点", 50),
      pinned: body.pinned === true,
      published: body.published !== false,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "说说不存在" }, { status: 404 });
    }

    revalidateShuoshuo();
    await logOperation({ action: "shuoshuo_update", target: `#${updated.id}` });

    return NextResponse.json({ ok: true, data: serialize(updated) });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的说说 id" }, { status: 400 });
  }

  const deleted = await deleteShuoshuo(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "说说不存在" }, { status: 404 });
  }

  await logOperation({ action: "shuoshuo_delete", target: `#${deleted.id}` });
  revalidateShuoshuo();

  return NextResponse.json({ ok: true, data: { id } });
}
