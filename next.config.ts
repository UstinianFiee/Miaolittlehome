import path from "node:path";

import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产镜像按 standalone 输出（阶段 16 Docker 部署依赖此配置）
  output: "standalone",

  /*
   * 显式指定文件追踪根目录。
   *
   * 不写时 Next 会向上找 lockfile 猜「工作区根」：本地把仓库当成另一个仓库的
   * worktree（例如 `.agents/worktrees/<branch>`）用时会猜错，standalone 产物的
   * 文件追踪范围可能偏大/偏小。这里固定成项目根，构建行为在任何路径下都一致。
   */
  outputFileTracingRoot: path.join(__dirname),

  // 不暴露 X-Powered-By
  poweredByHeader: false,

  experimental: {
    optimizePackageImports: [
      // 关键项：radix-ui 是「统一包」，`import { Slot } from "radix-ui"` 会把
      // 全部 Radix 原语（Dialog / Select / DropdownMenu / Switch …）都拉进依赖图，
      // 实测每个页面首包要多背 260KB 以上的原始 JS。
      // 加进按需导入后只会打包真正用到的那几个原语。
      "radix-ui",
      // 图标库同理（Next 默认已含，这里显式声明，避免日后升级默认列表变化时丢优化）
      "lucide-react",
    ],

    // 客户端路由缓存：静态页默认会缓存 5 分钟（300 秒）。
    // 表现就是「后台改完内容，点导航切过去还是旧的」——因为压根没请求服务端。
    // 压到 30 秒：改完内容基本立刻能看到，同时保留预取带来的快速导航。
    //
    // 注意：光靠这个**解决不了**「后台改设置后客户端路由缓存还是旧的」——
    // 那份预取缓存不受 revalidatePath 影响，得靠布局里的 ConfigSync 主动 refresh。
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },

  async redirects() {
    return [
      {
        // 根路径永久重定向到默认语言（docs/SPEC.md 技术约束 11）
        source: "/",
        destination: "/zh",
        statusCode: 301,
      },
      // 旧的分页链接（?page=N）→ 新的路径分页，保证外链不失效。
      // 分页之所以从查询参数改成路径段，是为了让首页/列表页能被静态预渲染 + ISR 缓存。
      {
        source: "/:locale(zh|en)/posts",
        has: [{ type: "query", key: "page", value: "(?<page>\\d+)" }],
        destination: "/:locale/posts/page/:page",
        permanent: true,
      },
      {
        source: "/:locale(zh|en)",
        has: [{ type: "query", key: "page", value: "(?<page>\\d+)" }],
        destination: "/:locale/page/:page",
        permanent: true,
      },
    ];
  },
};

// 默认读取 ./src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
