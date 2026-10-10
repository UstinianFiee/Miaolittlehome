import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateSoftware } from "@/lib/revalidate";
import { addSoftwareFile, isPlatform } from "@/lib/software";
import {
  completePackageUpload,
  discardPackageUpload,
  PackageError,
} from "@/lib/software-storage";
import { errorResponse, optionalString, requireInt, requireString } from "@/lib/validation";

/** 合并安装包分片并入库。 */
export async function POST(request: Request) {
  let uploadId: string | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    uploadId = requireString(body.uploadId, "上传标识", { max: 64 });

    const softwareId = requireInt(body.softwareId, "软件");
    const fileName = requireString(body.fileName, "文件名", { max: 255 });
    const platform = optionalString(body.platform, "平台", 20) ?? "windows";

    if (!isPlatform(platform)) {
      return NextResponse.json({ ok: false, error: "平台取值不合法" }, { status: 400 });
    }

    const completed = await completePackageUpload({
      uploadId,
      fileName,
      size: Number(body.size),
      totalChunks: Number(body.totalChunks),
    });

    const created = await addSoftwareFile({
      softwareId,
      version: requireString(body.version, "版本", { max: 50 }),
      platform,
      fileName,
      relativePath: completed.relative,
      fileSize: completed.size,
    });

    if (!created) {
      // 软件不存在：把刚落盘的文件清掉，避免留下孤儿
      await discardPackageUpload(uploadId).catch(() => undefined);
      return NextResponse.json({ ok: false, error: "软件不存在" }, { status: 404 });
    }

    revalidateSoftware();
    await logOperation({
      action: "software_file_add",
      target: created.fileName,
      detail: `${created.version} / ${created.platform}`,
    });

    return NextResponse.json(
      { ok: true, data: { ...created, fileSize: created.fileSize.toString() } },
      { status: 201 }
    );
  } catch (error) {
    if (uploadId) {
      await discardPackageUpload(uploadId).catch(() => undefined);
    }

    if (error instanceof PackageError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
