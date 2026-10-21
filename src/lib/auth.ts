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

/**
 * 生产环境下不可接受的 JWT 密钥特征。
 *
 * 这些是 `.env.example` / 部署模板里的占位值（或"以后再说"的临时值）。
 * 它们虽然长度可能够，但内容公开 —— 用它们签名等于任何人都能伪造管理员会话。
 */
const JWT_SECRET_PLACEHOLDERS = [
  "change-me",
  "replace-with",
  "your-secret",
  "your_secret",
  "changeme",
  "placeholder",
  "example",
  "todo",
];
/** 生产环境要求的最小长度（HS256 密钥至少 32 字节的熵才有意义）。 */
const JWT_SECRET_MIN_LENGTH = 32;

/** 开发环境只提醒一次，避免每次登录/校验都刷屏。 */
let warnedAboutWeakDevSecret = false;

/**
 * 读取并校验 JWT 签名密钥。
 *
 * - 生产环境（`NODE_ENV=production`）：长度 <32 或含占位特征 → 直接抛中文错误（fail-closed）。
 *   宁可登录接口 500，也不要用一个人人都知道的密钥签发会话。
 * - 开发环境：允许占位值，但提醒一次，方便本地直接跑起来。
 */
function getSecret(): string {
  const value = (process.env.JWT_SECRET ?? "").trim();

  if (!value) {
    throw new Error(
      "JWT_SECRET 未配置：请设置至少 32 位的随机字符串（可用 `openssl rand -base64 48` 生成）"
    );
  }

  const lowered = value.toLowerCase();
  const isPlaceholder = JWT_SECRET_PLACEHOLDERS.some((item) => lowered.includes(item));
  const isTooShort = value.length < JWT_SECRET_MIN_LENGTH;

  if (process.env.NODE_ENV === "production") {
    if (isPlaceholder || isTooShort) {
      throw new Error(
        "JWT_SECRET 不安全：生产环境要求至少 32 位且不能是模板占位值（change-me / replace-with / your-secret 等）。请用 `openssl rand -base64 48` 生成后写入 .env.production"
      );
    }
    return value;
  }

  if ((isPlaceholder || isTooShort) && !warnedAboutWeakDevSecret) {
    warnedAboutWeakDevSecret = true;
    console.warn(
      "[auth] 当前 JWT_SECRET 是占位值或长度不足 32 位，仅可用于本地开发；生产环境会直接拒绝签发/校验会话。"
    );
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
