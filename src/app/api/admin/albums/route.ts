import { NextResponse } from "next/server";

import { createAlbum, listAlbums } from "@/lib/albums";
import { logOperation } from "@/lib/logs";
import { revalidateAlbums } from "@/lib/revalidate";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

export async function GET() {
  const items = await listAlbums();
  return NextResponse.json({ ok: true, data: { items } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const created = await createAlbum({
      name: requireString(body.name, "相册名", { max: 50 }),
      nameEn: optionalString(body.nameEn, "英文名", 50),
      description: optionalString(body.description, "描述", 500),
      cover: optionalString(body.cover, "封面", 500),
      sort: Number(body.sort) || 0,
    });

    await logOperation({ action: "album_create", target: created.name });
    revalidateAlbums([created.id]);

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
