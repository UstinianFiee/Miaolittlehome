import { NextResponse } from "next/server";

import { getSoftwareFileForDownload, incrementDownload } from "@/lib/software";

/**
 * 安装包下载入口：先计数再 302 跳到真实文件地址。
 * 真实文件由 Nginx（生产）或 /software-files 路由（开发）直出。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fileId = Number(id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await getSoftwareFileForDownload(fileId);
  if (!file || !file.software.published) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    await incrementDownload(fileId);
  } catch (error) {
    // 计数失败不影响下载
    console.error("[software] 下载计数失败：", error);
  }

  return NextResponse.redirect(new URL(file.filePath, request.url), 302);
}
