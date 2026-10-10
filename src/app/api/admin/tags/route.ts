import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateTaxonomy } from "@/lib/revalidate";
import { createTag, findTagByName, listTags } from "@/lib/taxonomy";
import { errorResponse, requireString } from "@/lib/validation";

export async function GET() {
  const items = await listTags();
  return NextResponse.json({ ok: true, data: { items } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = requireString(body.name, "标签名", { max: 30 });

    if (await findTagByName(name)) {
      return NextResponse.json({ ok: false, error: "同名标签已存在" }, { status: 409 });
    }

    const created = await createTag(name);
    revalidateTaxonomy();
    await logOperation({ action: "tag_create", target: created.name });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
