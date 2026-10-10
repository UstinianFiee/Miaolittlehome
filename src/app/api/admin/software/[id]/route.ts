import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateSoftware } from "@/lib/revalidate";
import { deleteSoftware, updateSoftware } from "@/lib/software";
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
    return NextResponse.json({ ok: false, error: "无效的软件 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const updated = await updateSoftware(id, {
      name: requireString(body.name, "名称", { max: 100 }),
      nameEn: optionalString(body.nameEn, "英文名", 100),
      icon: optionalString(body.icon, "图标", 500),
      description: requireString(body.description, "描述", { max: 2000 }),
      published: body.published === true,
      sort: Number(body.sort) || 0,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "软件不存在" }, { status: 404 });
    }

    revalidateSoftware();
    await logOperation({ action: "software_update", target: updated.name });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的软件 id" }, { status: 400 });
  }

  const deleted = await deleteSoftware(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "软件不存在" }, { status: 404 });
  }

  revalidateSoftware();
  await logOperation({
    action: "software_delete",
    target: deleted.name,
    detail: `同时删除 ${deleted.files.length} 个安装包`,
  });

  return NextResponse.json({ ok: true, data: { id } });
}
