import { NextResponse } from "next/server";

import { getSiteVersion } from "@/lib/settings";

/**
 * 站点配置版本号（公开接口，只返回一个哈希，不含任何敏感信息）。
 *
 * 前端布局在 HTML 里渲染了渲染时的版本号，`ConfigSync` 用这个接口问一下当前值，
 * 对不上就 `router.refresh()` —— 解决「后台改了设置，客户端路由缓存里还是旧页面」的问题。
 *
 * 必须 `no-store`：这里要的就是「每次都问服务端」。
 *
 * `getSiteVersion` 内部用 `unstable_cache` 缓存 60 秒（后台写操作会 revalidateTag 主动失效），
 * 所以这个接口虽然被每个前台标签页轮询，实际只在缓存过期时才读一次库，开销很小。
 */
export async function GET() {
  return NextResponse.json(
    { version: await getSiteVersion() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// 明确走动态渲染，避免被当成静态路由在构建期固定住版本号
export const dynamic = "force-dynamic";
