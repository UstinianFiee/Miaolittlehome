/**
 * 时间展示工具。
 * 数据库统一存 UTC；前端按 docs/SPEC.md 技术约束 13 同时展示 UTC+8 与 UTC。
 */

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function format(date: Date, offsetMs: number): string {
  const shifted = new Date(date.getTime() + offsetMs);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    ` ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

/** 例：2026-10-09 14:30 */
export function formatUtc8(date: Date): string {
  return format(date, UTC8_OFFSET_MS);
}

/** 例：2026-10-09 06:30 */
export function formatUtc(date: Date): string {
  return format(date, 0);
}

/** 例：2026-10-09 14:30 (UTC+8) / 06:30 (UTC) */
export function formatDual(date: Date): string {
  return `${formatUtc8(date)} (UTC+8) / ${formatUtc(date).slice(-5)} (UTC)`;
}
