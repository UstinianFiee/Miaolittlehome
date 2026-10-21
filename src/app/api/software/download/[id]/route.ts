import { NextResponse } from "next/server";

import { getSoftwareFileForDownload, incrementDownload } from "@/lib/software";
import { relativeFromPackagePublicPath, resolvePackagePath } from "@/lib/software-storage";

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

/**
 * 库里存的 `filePath` 必须是本站安装包路径。
 *
 * 备份导入时该字段来自包里的字符串（不经过上传校验），若不校验就拼进 Location，
 * 就成了开放重定向（`Location: https://evil`）。这里按上传侧的同一套规则验一遍。
 */
function isServablePackagePath(filePath: string): boolean {
  if (!filePath.startsWith("/software-files/")) {
    return false;
  }
  try {
    resolvePackagePath(relativeFromPackagePublicPath(filePath));
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fileId = Number(id);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await getSoftwareFileForDownload(fileId);
  if (!file || !file.software.published || !isServablePackagePath(file.filePath)) {
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
