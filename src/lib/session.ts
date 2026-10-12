import { cookies, headers } from "next/headers";

import {
  SESSION_COOKIE,
  sessionMaxAge,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/auth";

/** 仅可在 Server Component / Route Handler / Server Action 中调用。 */

/**
 * 是否给会话 Cookie 加 `Secure` 标记。
 *
 * **不能直接用 `NODE_ENV === "production"` 判断**：生产环境如果走纯 HTTP
 * （例如用 IP 直接访问、还没配 HTTPS），带 `Secure` 的 Cookie 会被浏览器
 * 静默丢弃 —— 现象就是「登录接口返回 200，但页面又跳回登录页」。
 *
 * 这里按**实际请求协议**判断（Nginx 已经传了 `X-Forwarded-Proto`），
 * 并允许用环境变量 `SESSION_COOKIE_SECURE` 强制覆盖：
 *   - `true`  ：始终加 Secure（确定只跑 HTTPS 时可用）
 *   - `false` ：始终不加（反代没透传协议头时的兜底）
 *   - 不设置  ：自动判断
 */
async function shouldUseSecureCookie(): Promise<boolean> {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "false") {
    return override === "true";
  }

  try {
    const store = await headers();
    const proto = store.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    if (proto) {
      return proto === "https";
    }
  } catch {
    // 不在请求上下文中（例如脚本里直接调用）时按「不加 Secure」处理
  }

  return false;
}

async function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: await shouldUseSecureCookie(),
    path: "/",
    maxAge,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function createSession(user: { id: number; username: string }): Promise<void> {
  const maxAge = sessionMaxAge();
  const token = signSession({ uid: user.id, username: user.username }, maxAge);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, await cookieOptions(maxAge));
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", await cookieOptions(0));
}
