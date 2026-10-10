import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateSoftware } from "@/lib/revalidate";
import { createSoftware, listSoftwareForAdmin } from "@/lib/software";
import { errorResponse, optionalString, requireString } from "@/lib/validation";

export async function GET() {
  const items = await listSoftwareForAdmin();

  return NextResponse.json({
    ok: true,
    data: {
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        // BigInt 不能直接序列化
        files: item.files.map((file) => ({
          ...file,
          fileSize: file.fileSize.toString(),
          createdAt: file.createdAt.toISOString(),
        })),
      })),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const created = await createSoftware({
      name: requireString(body.name, "名称", { max: 100 }),
      nameEn: optionalString(body.nameEn, "英文名", 100),
      icon: optionalString(body.icon, "图标", 500),
      description: requireString(body.description, "描述", { max: 2000 }),
      published: body.published === true,
      sort: Number(body.sort) || 0,
    });

    revalidateSoftware();
    await logOperation({ action: "software_create", target: created.name });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
