import { NextResponse } from "next/server";

import { deleteFriend, updateFriend } from "@/lib/friends";
import { logOperation } from "@/lib/logs";
import { revalidateProfile } from "@/lib/revalidate";
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
    return NextResponse.json({ ok: false, error: "无效的友链 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const url = requireString(body.url, "网址", { max: 500 });

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ ok: false, error: "网址需以 http:// 或 https:// 开头" }, { status: 400 });
    }

    const updated = await updateFriend(id, {
      name: requireString(body.name, "名称", { max: 100 }),
      url,
      avatar: optionalString(body.avatar, "头像", 500),
      description: optionalString(body.description, "描述", 300),
      sort: Number(body.sort) || 0,
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "友链不存在" }, { status: 404 });
    }

    revalidateProfile();
    await logOperation({ action: "friend_update", target: updated.name });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的友链 id" }, { status: 400 });
  }

  const deleted = await deleteFriend(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "友链不存在" }, { status: 404 });
  }

  revalidateProfile();
  await logOperation({ action: "friend_delete", target: deleted.name });

  return NextResponse.json({ ok: true, data: { id } });
}
