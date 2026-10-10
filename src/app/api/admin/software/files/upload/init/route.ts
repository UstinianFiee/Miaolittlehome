import { NextResponse } from "next/server";

import { PackageError, assertPackageExtension, assertPackageSize, preparePackageUpload } from "@/lib/software-storage";
import { errorResponse, requireString } from "@/lib/validation";

/** 开始上传安装包：校验格式与大小（≤2GB），返回分片方案。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileName = requireString(body.fileName, "文件名", { max: 255 });
    const size = Number(body.size);

    assertPackageExtension(fileName);
    assertPackageSize(size);

    const plan = await preparePackageUpload(size);

    return NextResponse.json({ ok: true, data: plan });
  } catch (error) {
    if (error instanceof PackageError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
