import { NextResponse } from "next/server";

import { assertSize, detectKind, MediaError, prepareMediaUpload } from "@/lib/media";
import { errorResponse, requireString } from "@/lib/validation";

/** 开始上传：校验类型与大小，返回分片方案。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileName = requireString(body.fileName, "文件名", { max: 255 });
    const size = Number(body.size);

    detectKind(fileName);
    assertSize(size);

    const plan = await prepareMediaUpload(size);

    return NextResponse.json({ ok: true, data: plan });
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
