import { serveStaticFile } from "@/lib/serve-file";
import { SOFTWARE_DIR } from "@/lib/software-storage";

/**
 * 开发环境的软件安装包直出。
 * 生产环境由 Nginx alias 直出（/software-files/ → /data/software/），不经过本路由。
 * 支持 Range，便于大文件续传式下载。
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relative = segments.map((segment) => decodeURIComponent(segment)).join("/");

  return serveStaticFile(request, relative, { root: SOFTWARE_DIR, cacheSeconds: 86400 });
}
