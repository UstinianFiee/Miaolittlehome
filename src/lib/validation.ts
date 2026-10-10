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

/** 把 ValidationError 转成统一的错误响应体。 */
export function errorResponse(error: unknown): { message: string; status: number } {
  if (error instanceof ValidationError) {
    return { message: error.message, status: 400 };
  }
  console.error("[api] 未预期的错误：", error);
  return { message: "服务器内部错误", status: 500 };
}
