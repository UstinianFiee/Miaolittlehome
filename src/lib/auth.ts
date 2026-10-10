import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 自写 JWT（HS256），不引入 JWT 库。
 *
 * 说明：middleware 使用 Node.js 运行时（Next.js 15.5 起稳定），因此这里可以
 * 直接使用 node:crypto，无需 Web Crypto，也不依赖 Edge 运行时。
 */

export const SESSION_COOKIE = "blog_session";

const JWT_ALG = "HS256";
const FALLBACK_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionPayload = {
  /** 用户 id */
  uid: number;
  username: string;
  /** 签发时间（秒） */
  iat: number;
  /** 过期时间（秒） */
  exp: number;
};

function getSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("JWT_SECRET 未配置或长度不足 16 位");
  }
  return value;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(signingInput: string): string {
  return createHmac("sha256", getSecret()).update(signingInput).digest("base64url");
}

/** 解析 "7d" / "12h" / "30m" / "60s" 形式的有效期，返回秒数。 */
export function parseDuration(value: string | undefined, fallbackSeconds = FALLBACK_MAX_AGE): number {
  if (!value) {
    return fallbackSeconds;
  }

  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) {
    return fallbackSeconds;
  }

  const factors: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const amount = Number(match[1]);
  const unit = match[2] ?? "s";

  return amount * (factors[unit] ?? 1);
}

export function sessionMaxAge(): number {
  return parseDuration(process.env.JWT_EXPIRES);
}

export function signSession(
  input: { uid: number; username: string },
  maxAgeSeconds: number = sessionMaxAge()
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: input.uid,
    username: input.username,
    iat: now,
    exp: now + maxAgeSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALG, typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  return `${signingInput}.${sign(signingInput)}`;
}

/** 校验签名与有效期；任何异常一律返回 null（不泄露失败原因）。 */
export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, provided] = parts;

  let parsedHeader: unknown;
  try {
    parsedHeader = JSON.parse(base64UrlDecode(header));
  } catch {
    return null;
  }

  if (
    !parsedHeader ||
    typeof parsedHeader !== "object" ||
    (parsedHeader as { alg?: unknown }).alg !== JWT_ALG
  ) {
    return null;
  }

  const expected = sign(`${header}.${body}`);
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(base64UrlDecode(body));
  } catch {
    return null;
  }

  if (!parsedPayload || typeof parsedPayload !== "object") {
    return null;
  }

  const { uid, username, iat, exp } = parsedPayload as Partial<SessionPayload>;

  if (
    typeof uid !== "number" ||
    typeof username !== "string" ||
    typeof iat !== "number" ||
    typeof exp !== "number"
  ) {
    return null;
  }

  if (exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { uid, username, iat, exp };
}
