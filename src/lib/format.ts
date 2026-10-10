/** 通用格式化工具。 */

/** 字节数转可读大小。接受 number 或字符串（BigInt 序列化后的形式）。 */
export function formatBytes(raw: number | string | bigint): string {
  const bytes = typeof raw === "bigint" ? Number(raw) : Number(raw);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
