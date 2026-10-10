import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { destroySession, getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();

  await destroySession();

  if (session) {
    await logOperation({ action: "auth_logout", target: session.username });
  }

  return NextResponse.json({ ok: true });
}
