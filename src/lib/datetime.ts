/**
 * 时间展示工具。
 * 数据库统一存 UTC；前端按 docs/SPEC.md 技术约束 13 同时展示 UTC+8 与 UTC。
 *
 * 界面里请优先用 `<DualTime>` 组件（`src/components/site/dual-time.tsx`），
 * 它默认显示浏览器本地时间，交互展开 UTC / UTC+8；这里提供稳定的 SSR 回退与参考时间。
 * 这里的 `formatDual()` 只留给纯文本场景（备份包 README、日志详情等）。
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

export type DualTimeParts = {
  /** ISO 字符串，用于 <time dateTime> */
  iso: string;
  /** 2026-10-09 */
  date: string;
  /** 14:30 —— 北京时间，界面主时间 */
  time: string;
  /** 06:30 —— 同一时刻的 UTC，作为附注 */
  utcTime: string;
  /** 完整北京时间字符串（2026-10-09 14:30） */
  utc8Full: string;
  /** 完整 UTC 字符串（2026-10-09 06:30） */
  utcFull: string;
};

/**
 * 拆成可直接排版的片段，避免界面层再解析字符串。
 * 只读 UTC 字段，所以服务端与浏览器渲染结果一致，不会水合不匹配。
 */
export function dualTimeParts(date: Date): DualTimeParts {
  const utc8Full = formatUtc8(date);
  const utcFull = formatUtc(date);

  return {
    iso: date.toISOString(),
    date: utc8Full.slice(0, 10),
    time: utc8Full.slice(-5),
    utcTime: utcFull.slice(-5),
    utc8Full,
    utcFull,
  };
}

/** 例：2026-10-09 14:30 (UTC+8) / 06:30 (UTC) —— 仅用于纯文本场景。 */
export function formatDual(date: Date): string {
  return `${formatUtc8(date)} (UTC+8) / ${formatUtc(date).slice(-5)} (UTC)`;
}
