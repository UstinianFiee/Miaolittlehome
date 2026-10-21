/**
 * 轻量请求体校验工具。
 * 不引入校验库（技术栈未包含），保持零额外依赖。
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function requireString(
  value: unknown,
  field: string,
  { max = 500, min = 1 }: { max?: number; min?: number } = {}
): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} 必须是字符串`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${field} 不能为空`);
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} 长度不能超过 ${max}`);
  }
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 2000): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} 必须是字符串`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} 长度不能超过 ${max}`);
  }
  return trimmed;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function optionalInt(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new ValidationError(`${field} 必须是整数`);
  }
  return parsed;
}

export function requireInt(value: unknown, field: string): number {
  const parsed = optionalInt(value, field);
  if (parsed === null) {
    throw new ValidationError(`${field} 不能为空`);
  }
  return parsed;
}

/** 解析「逗号/顿号/空格分隔」的标签名列表，去重并保序。 */
export function parseTagNames(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").map((s) => s.trim()).filter(Boolean);
  }
  if (typeof value !== "string") {
    throw new ValidationError("标签格式不正确");
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of value.split(/[,，、\s]+/)) {
    const name = part.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

/** 请求体超过允许大小（用于 Content-Length 预检，映射成 413）。 */
export class PayloadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * 校验请求体大小：`Content-Length` 超限立即抛 413，避免先把整个 body
 * 读进内存再发现太大。
 *
 * 分块传输（没有 Content-Length）时这里放行，由下游的分片大小上限兜底。
 */
export function assertBodyWithinLimit(request: Request, maxBytes: number): void {
  const header = request.headers.get("content-length");
  if (!header) {
    return;
  }

  const length = Number(header);
  if (!Number.isFinite(length) || length < 0) {
    throw new ValidationError("请求体长度不合法");
  }
  if (length > maxBytes) {
    throw new PayloadTooLargeError(
      `请求体过大（${Math.ceil(length / 1024)}KB），上限 ${Math.floor(maxBytes / 1024)}KB`
    );
  }
}

/**
 * Prisma 已知错误码 → 可读中文与正确的 HTTP 状态。
 *
 * 用鸭子类型判断（不 import `@prisma/client`），避免这个纯工具模块把 Prisma
 * 运行时带进任何非数据库调用方。
 */
const PRISMA_ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  P2002: { message: "数据已存在（唯一约束冲突），请换一个名称或标识", status: 409 },
  P2003: { message: "引用的数据不存在（外键约束），请检查关联项", status: 400 },
  P2025: { message: "要操作的数据不存在或已被删除", status: 404 },
};

function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** 把已知错误转成统一的错误响应体。 */
export function errorResponse(error: unknown): { message: string; status: number } {
  if (error instanceof ValidationError) {
    return { message: error.message, status: 400 };
  }
  if (error instanceof PayloadTooLargeError) {
    return { message: error.message, status: 413 };
  }

  const code = prismaErrorCode(error);
  if (code) {
    const mapped = PRISMA_ERROR_MESSAGES[code];
    if (mapped) {
      console.error(`[api] 数据库约束错误（${code}）：`, error);
      return mapped;
    }
  }

  console.error("[api] 未预期的错误：", error);
  return { message: "服务器内部错误", status: 500 };
}
