import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

/** 用户不存在时也执行一次比较，避免通过响应时间区分「用户是否存在」。 */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 10);

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

function isValidCredential(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const { username, password } = body;

  if (!isValidCredential(username, 64) || !isValidCredential(password, 200)) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  await createSession(user);
  await logOperation({ action: "auth_login", target: user.username });

  return NextResponse.json({ ok: true });
}
