import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  sessionMaxAge,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/auth";

/** 仅可在 Server Component / Route Handler / Server Action 中调用。 */

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
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
  store.set(SESSION_COOKIE, token, cookieOptions(maxAge));
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(0));
}
