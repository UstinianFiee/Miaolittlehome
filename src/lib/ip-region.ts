import path from "node:path";

import IP2Region from "ip2region";

/**
 * IP 归属地解析（docs/SPEC.md 技术约束 11）。
 * 使用 ip2region 离线库，数据文件随仓库自带（data/），运行时不联网查询。
 */

const IPV4_DB = path.resolve(process.env.IP2REGION_DB ?? "./data/ip2region.db");
const IPV6_DB = path.resolve(process.env.IP2REGION_IPV6_DB ?? "./data/ipv6wry.db");

let instance: IP2Region | null = null;
let unavailable = false;

function getInstance(): IP2Region | null {
  if (unavailable) {
    return null;
  }

  if (!instance) {
    try {
      instance = new IP2Region({ ipv4db: IPV4_DB, ipv6db: IPV6_DB });
    } catch (error) {
      // 数据文件缺失时降级：不影响评论提交
      console.error("[ip-region] 离线库加载失败，将跳过归属地解析：", error);
      unavailable = true;
      return null;
    }
  }

  return instance;
}

/** 内网 / 回环地址不查询归属地。 */
export function isPrivateIp(ip: string): boolean {
  const value = (ip ?? "").trim().toLowerCase();

  if (!value) {
    return true;
  }
  if (value === "::1" || value === "localhost") {
    return true;
  }
  if (value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.")) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) {
    return true;
  }
  if (value.startsWith("169.254.") || value.startsWith("fc") || value.startsWith("fd")) {
    return true;
  }
  if (value.startsWith("fe80") || value.startsWith("::ffff:127.")) {
    return true;
  }

  return false;
}

/** 解析为「国家 省 市」（去重）；内网、未知或失败时返回 null。 */
export function resolveIpRegion(ip: string): string | null {
  const value = (ip ?? "").trim();

  if (!value || isPrivateIp(value)) {
    return null;
  }

  const region = getInstance();
  if (!region) {
    return null;
  }

  try {
    const result = region.search(value);
    if (!result) {
      return null;
    }

    const parts = [result.country, result.province, result.city]
      .map((part) => (part ?? "").trim())
      .filter((part) => part.length > 0 && part !== "0");

    const unique = [...new Set(parts)];
    return unique.length > 0 ? unique.join(" ") : null;
  } catch {
    return null;
  }
}

/** 从请求头里取客户端 IP（Nginx 反代时优先取 X-Forwarded-For 的第一段）。 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return headers.get("x-real-ip")?.trim() || "";
}
