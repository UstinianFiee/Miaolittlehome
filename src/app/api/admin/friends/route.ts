import { NextResponse } from "next/server";

import { createFriend, listFriends } from "@/lib/friends";
import { logOperation } from "@/lib/logs";
import { revalidateProfile } from "@/lib/revalidate";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

export async function GET() {
  const items = await listFriends();
  return NextResponse.json({ ok: true, data: { items } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const url = requireString(body.url, "网址", { max: 500 });

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ ok: false, error: "网址需以 http:// 或 https:// 开头" }, { status: 400 });
    }

    const created = await createFriend({
      name: requireString(body.name, "名称", { max: 100 }),
      url,
      avatar: optionalString(body.avatar, "头像", 500),
      description: optionalString(body.description, "描述", 300),
      sort: Number(body.sort) || 0,
    });

    revalidateProfile();
    await logOperation({ action: "friend_create", target: created.name });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
