import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { clientIpFromHeaders } from "@/lib/ip-region";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/login-guard";
import { logOperation } from "@/lib/logs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { assertBodyWithinLimit, PayloadTooLargeError } from "@/lib/validation";

/** 用户不存在时也执行一次比较，避免通过响应时间区分「用户是否存在」。 */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 10);

/** 登录请求体上限：用户名 64 + 密码 200，64KB 绰绰有余。 */
const LOGIN_BODY_MAX_BYTES = 64 * 1024;

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

function isValidCredential(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers) || "unknown";

  // 登录失败限频：连续失败达阈值后锁定一段时间，避免被长期跑字典
  const blockedFor = loginBlockedFor(ip);
  if (blockedFor !== null) {
    return NextResponse.json(
      { ok: false, error: `登录尝试过于频繁，请 ${Math.ceil(blockedFor / 60)} 分钟后再试` },
      { status: 429 }
    );
  }

  let body: LoginBody;
  try {
    assertBodyWithinLimit(request, LOGIN_BODY_MAX_BYTES);
    body = (await request.json()) as LoginBody;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 413 });
    }
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const { username, password } = body;

  if (!isValidCredential(username, 64) || !isValidCredential(password, 200)) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    recordLoginFailure(ip);
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  clearLoginFailures(ip);
  await createSession(user);
  await logOperation({ action: "auth_login", target: user.username });

  return NextResponse.json({ ok: true });
}
