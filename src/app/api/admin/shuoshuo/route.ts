import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateShuoshuo } from "@/lib/revalidate";
import { createShuoshuo, listShuoshuoForAdmin, SHUOSHUO_MAX_IMAGES } from "@/lib/shuoshuo";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

/** 把存库的 JSON 字符串解析成路径数组。 */
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

function serialize(item: Awaited<ReturnType<typeof createShuoshuo>>) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET() {
  const items = await listShuoshuoForAdmin();
  return NextResponse.json({ ok: true, data: { items: items.map(serialize) } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const created = await createShuoshuo({
      content: requireString(body.content, "说说内容", { max: 2000 }),
      contentEn: optionalString(body.contentEn, "英文内容", 2000),
      images: parseImages(body.images),
      location: optionalString(body.location, "地点", 50),
      pinned: body.pinned === true,
      published: body.published !== false,
    });

    revalidateShuoshuo();
    await logOperation({
      action: "shuoshuo_create",
      target: `#${created.id}`,
      detail: created.content.slice(0, 40),
    });

    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
