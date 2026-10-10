import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateTaxonomy } from "@/lib/revalidate";
import { createCategory, isCategoryType, listCategories, normalizeSort } from "@/lib/taxonomy";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

export async function GET() {
  const items = await listCategories();
  return NextResponse.json({ ok: true, data: { items } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const type = requireString(body.type, "类型", { max: 20 });
    if (!isCategoryType(type)) {
      return NextResponse.json(
        { ok: false, error: "类型只能是 post / video / software" },
        { status: 400 }
      );
    }

    const created = await createCategory({
      name: requireString(body.name, "名称", { max: 50 }),
      nameEn: optionalString(body.nameEn, "英文名", 50),
      type,
      sort: normalizeSort(body.sort),
    });

    revalidateTaxonomy();
    await logOperation({ action: "category_create", target: created.name });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
