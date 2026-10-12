import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产镜像按 standalone 输出（阶段 16 Docker 部署依赖此配置）
  output: "standalone",

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
