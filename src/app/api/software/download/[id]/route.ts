import { NextResponse } from "next/server";

import { getSoftwareFileForDownload, incrementDownload } from "@/lib/software";

/**
 * 安装包下载入口：先计数再 302 跳到真实文件地址。
 * 真实文件由 Nginx（生产）或 /software-files 路由（开发）直出。
 *
 * ⚠️ 这里**不能用 `NextResponse.redirect(new URL(file.filePath, request.url))`**。
 * 容器里 `request.url` 的主机来自 `HOSTNAME`/`PORT`（compose 里是 `0.0.0.0:3000`），
 * 不是浏览器实际访问的域名；拼出来的绝对地址会让下载跳到
 * `https://0.0.0.0:3000/software-files/...`，浏览器直接报 ERR_ADDRESS_INVALID。
 * 回一个**相对路径**的 Location 最稳：由浏览器按当前地址自己解析。
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

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: file.filePath,
      "Cache-Control": "no-store",
    },
  });
}
