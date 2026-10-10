import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产镜像按 standalone 输出（阶段 16 Docker 部署依赖此配置）
  output: "standalone",

  async redirects() {
    return [
      {
        // 根路径永久重定向到默认语言（docs/SPEC.md 技术约束 11）
        source: "/",
        destination: "/zh",
        statusCode: 301,
      },
    ];
  },
};

// 默认读取 ./src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
