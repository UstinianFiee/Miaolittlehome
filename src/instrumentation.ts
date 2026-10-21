/**
 * Next.js 启动钩子（instrumentation）。
 *
 * 只在 Node.js 运行时执行；用来把「首次请求才付的代价」提前到启动阶段：
 * ip2region 离线库约 11MB，是同步读盘的，放在请求里会拖慢第一次访问。
 *
 * 另外把「生产环境安全配置检查」也放在这里：部署时照抄模板、忘了改密钥是最常见的失误，
 * 启动时在日志里大声报出来，比等到登录/评论报错更早发现问题。
 * 注意这里**只告警、不抛错**：公开页面不依赖这些密钥，没必要因为管理员配置失误把整站打挂；
 * 真正使用密钥的地方（签发会话、评论限频）仍然是 fail-closed。
 */
function warnInsecureProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const problems: string[] = [];
  const placeholderPattern = /change-me|replace-with|your-secret|your_secret|changeme|placeholder|example|todo/i;

  const jwtSecret = (process.env.JWT_SECRET ?? "").trim();
  if (!jwtSecret) {
    problems.push("JWT_SECRET 未配置（后台登录将不可用）");
  } else if (jwtSecret.length < 32 || placeholderPattern.test(jwtSecret)) {
    problems.push("JWT_SECRET 是模板占位值或长度不足 32 位（后台登录将不可用）");
  }

  const ipHashSalt = (process.env.IP_HASH_SALT ?? "").trim();
  if (!ipHashSalt) {
    problems.push("IP_HASH_SALT 未配置（评论提交与来源限频将不可用）");
  } else if (/change-me|replace-with/i.test(ipHashSalt)) {
    problems.push("IP_HASH_SALT 仍是模板占位值（评论提交与来源限频将不可用）");
  }

  if (problems.length > 0) {
    console.error(
      [
        "",
        "==================== 生产环境安全配置检查未通过 ====================",
        ...problems.map((item) => `- ${item}`),
        "生成强随机值：",
        "  JWT_SECRET=$(openssl rand -base64 48)",
        "  IP_HASH_SALT=$(openssl rand -base64 32)",
        "写入 .env.production 后重新 up -d 应用容器。详见 docs/部署.md。",
        "==================================================================",
        "",
      ].join("\n")
    );
  }
}

export async function register() {
  // 显式用 `=== "nodejs"` 分支：Next 会按运行时把 process.env.NEXT_RUNTIME 替换成字面量，
  // 边缘运行时在构建期就能整块裁掉这个 import。若写成 `!== "nodejs" return`，
  // 边缘构建仍会尝试打包 @/lib/ip-region → ip2region → node:net，导致编译失败。
  if (process.env.NEXT_RUNTIME === "nodejs") {
    warnInsecureProductionConfig();
    const { warmupIpRegion } = await import("@/lib/ip-region");
    warmupIpRegion();
  }
}
