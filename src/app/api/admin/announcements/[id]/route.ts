import { NextResponse } from "next/server";

import { deleteAnnouncement, updateAnnouncement } from "@/lib/announcements";
import { logOperation } from "@/lib/logs";
import { revalidateAnnouncements } from "@/lib/revalidate";
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
    return NextResponse.json({ ok: false, error: "无效的公告 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const updated = await updateAnnouncement(id, {
      content: requireString(body.content, "公告内容", { max: 500 }),
      pinned: body.pinned === true,
      published: body.published !== false,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "公告不存在" }, { status: 404 });
    }

    revalidateAnnouncements();
    await logOperation({ action: "announcement_update", target: `#${updated.id}` });

    return NextResponse.json({ ok: true, data: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() } });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的公告 id" }, { status: 400 });
  }

  const deleted = await deleteAnnouncement(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "公告不存在" }, { status: 404 });
  }

  revalidateAnnouncements();
  await logOperation({ action: "announcement_delete", target: `#${deleted.id}` });

  return NextResponse.json({ ok: true, data: { id } });
}
