import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { clientIpFromHeaders, resolveIpRegion } from "@/lib/ip-region";
import { logVisit } from "@/lib/logs";

const intlMiddleware = createMiddleware(routing);

/** 无需登录即可访问的后台路径 */
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin")
  );
}

/** 只记录「前台页面」的访问：排除 API、后台、静态资源、预取与 RSC 请求。 */
function shouldLogVisit(request: NextRequest, pathname: string): boolean {
  if (request.method !== "GET") {
    return false;
  }
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return false;
  }
  // 带扩展名的静态文件
  if (/\.[a-z0-9]+$/i.test(pathname)) {
    return false;
  }
  // 预取请求（Next.js 会在鼠标悬停时预取）
  if (request.headers.get("next-router-prefetch") === "1") {
    return false;
  }
  if (request.headers.get("purpose") === "prefetch") {
    return false;
  }
  if (request.nextUrl.searchParams.has("_rsc")) {
    return false;
  }
  // 只记录 HTML 页面请求
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function handleAdmin(request: NextRequest, pathname: string) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  // 管理 API：未登录返回 401（不重定向，避免前端拿到 HTML）
  if (pathname.startsWith("/api/admin")) {
    if (PUBLIC_ADMIN_PATHS.has(pathname) || session) {
      return NextResponse.next();
    }
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 登录页：已登录则直接进后台
  if (pathname === "/admin/login") {
    return session ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }

  // 其余后台页面：未登录跳登录页，并记录来源
  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    if (pathname !== "/admin") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    return handleAdmin(request, pathname);
  }

  if (shouldLogVisit(request, pathname)) {
    const ip = clientIpFromHeaders(request.headers);
    await logVisit({
      path: pathname,
      ua: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
      ipRegion: ip ? resolveIpRegion(ip) : null,
    });
  }

  return intlMiddleware(request);
}

export const config = {
  // 前台走语言协商；后台与后台 API 单独匹配（见 handleAdmin）
  matcher: [
    "/((?!api|trpc|_next|_vercel|admin|.*\\..*).*)",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
  // Next.js 15.5 起 middleware 支持 Node.js 运行时（稳定），
  // 这样可以直接使用 node:crypto 校验 JWT、读取运行时环境变量，并访问数据库。
  runtime: "nodejs",
};
