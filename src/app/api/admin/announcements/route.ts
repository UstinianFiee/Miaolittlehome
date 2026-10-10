import { NextResponse } from "next/server";

import { createAnnouncement, listAnnouncementsForAdmin } from "@/lib/announcements";
import { logOperation } from "@/lib/logs";
import { revalidateAnnouncements } from "@/lib/revalidate";
import { errorResponse, requireString } from "@/lib/validation";

export async function GET() {
  const items = await listAnnouncementsForAdmin();
  return NextResponse.json({
    ok: true,
    data: { items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })) },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const created = await createAnnouncement({
      content: requireString(body.content, "公告内容", { max: 500 }),
      pinned: body.pinned === true,
      published: body.published !== false,
    });

    revalidateAnnouncements();
    await logOperation({ action: "announcement_create", target: `#${created.id}`, detail: created.content.slice(0, 40) });

    return NextResponse.json({ ok: true, data: { ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() } }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
