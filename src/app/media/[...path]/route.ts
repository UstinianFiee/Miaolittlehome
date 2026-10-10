import { MEDIA_DIR } from "@/lib/media";
import { serveStaticFile } from "@/lib/serve-file";

/**
 * 开发环境的媒体直出（docs/SPEC.md 技术约束 9）。
 * 生产环境由 Nginx alias 直出（/media/ → /data/media/），不经过本路由。
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relative = segments.map((segment) => decodeURIComponent(segment)).join("/");

  return serveStaticFile(request, relative, { root: MEDIA_DIR });
}
