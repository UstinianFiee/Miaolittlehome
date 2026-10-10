import { UAParser } from "ua-parser-js";

/**
 * User-Agent 解析（docs/SPEC.md 技术约束 11）。
 * 输出「浏览器 版本 · 系统 · 设备类型」的简短摘要，用于评论列表展示。
 */

export type UserAgentInfo = {
  browser: string;
  os: string;
  device: string;
  summary: string;
};

export function parseUserAgent(userAgent: string | null | undefined): UserAgentInfo | null {
  const value = (userAgent ?? "").trim();
  if (!value) {
    return null;
  }

  try {
    const result = new UAParser(value).getResult();

    const browser = [result.browser.name, result.browser.version?.split(".")[0]]
      .filter(Boolean)
      .join(" ");
    const os = [result.os.name, result.os.version].filter(Boolean).join(" ");
    const device = result.device.type ?? (result.device.model ? "Mobile" : "Desktop");

    const summary = [browser, os, device].filter(Boolean).join(" · ");

    return {
      browser,
      os,
      device,
      summary: summary || "未知设备",
    };
  } catch {
    return null;
  }
}
