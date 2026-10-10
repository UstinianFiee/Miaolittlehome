import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateSoftware } from "@/lib/revalidate";
import { deleteSoftwareFile } from "@/lib/software";
import { errorResponse } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

/** 删除某个安装包（同时删除磁盘文件）。 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const fileId = Number(id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    return NextResponse.json({ ok: false, error: "无效的安装包 id" }, { status: 400 });
  }

  try {
    const deleted = await deleteSoftwareFile(fileId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "安装包不存在" }, { status: 404 });
    }

    revalidateSoftware();
    await logOperation({ action: "software_file_delete", target: deleted.fileName });

    return NextResponse.json({ ok: true, data: { id: fileId } });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
