/**
 * Next.js 启动钩子（instrumentation）。
 *
 * 只在 Node.js 运行时执行；用来把「首次请求才付的代价」提前到启动阶段：
 * ip2region 离线库约 11MB，是同步读盘的，放在请求里会拖慢第一次访问。
 */
export async function register() {
  // 显式用 `=== "nodejs"` 分支：Next 会按运行时把 process.env.NEXT_RUNTIME 替换成字面量，
  // 边缘运行时在构建期就能整块裁掉这个 import。若写成 `!== "nodejs" return`，
  // 边缘构建仍会尝试打包 @/lib/ip-region → ip2region → node:net，导致编译失败。
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmupIpRegion } = await import("@/lib/ip-region");
    warmupIpRegion();
  }
}
