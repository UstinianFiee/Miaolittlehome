/**
 * Next.js 启动钩子（instrumentation）。
 *
 * 只在 Node.js 运行时执行；用来把「首次请求才付的代价」提前到启动阶段：
 * ip2region 离线库约 11MB，是同步读盘的，放在请求里会拖慢第一次访问。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warmupIpRegion } = await import("@/lib/ip-region");
  warmupIpRegion();
}
