import crypto from "node:crypto";

/**
 * 后台登录失败限频（进程内存态）。
 *
 * 后台登录是公网可达的：没有限频就等于允许无限次猜密码，
 * bcrypt 只让单次校验变慢，挡不住长期跑字典。
 * 这里按 IP 统计连续失败次数，超过阈值后锁定一段时间，登录成功即清零。
 *
 * 为什么放内存：本应用是单容器部署（compose 里只有一个 app 服务），
 * 进程重启后计数归零 —— 重启不是攻击者能触发的，可以接受。
 * 将来若横向扩容，需要换成 Redis 之类的共享存储。
 */

/** 窗口期内允许的连续失败次数 */
const MAX_FAILURES = 10;
/** 计数窗口 / 锁定时长 */
const WINDOW_MS = 15 * 60 * 1000;
/** 内存表上限，防止被大量不同 IP 撑爆 */
const MAX_ENTRIES = 5000;

type Entry = { count: number; firstAt: number };

const failures = new Map<string, Entry>();

/** 只存哈希，不在内存里留原始 IP。 */
function keyOf(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "blog-login-guard";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** 清掉过期条目；顺带在超量时丢弃最早的一批。 */
function prune(now: number): void {
  for (const [key, entry] of failures) {
    if (now - entry.firstAt >= WINDOW_MS) {
      failures.delete(key);
    }
  }
  if (failures.size <= MAX_ENTRIES) {
    return;
  }
  // Map 保持插入顺序，从最早的开始丢
  const excess = failures.size - MAX_ENTRIES;
  let dropped = 0;
  for (const key of failures.keys()) {
    failures.delete(key);
    dropped += 1;
    if (dropped >= excess) {
      break;
    }
  }
}

/**
 * 该 IP 是否已被锁定。
 * @returns 仍需等待的秒数；未锁定返回 null
 */
export function loginBlockedFor(ip: string): number | null {
  const key = keyOf(ip);
  const entry = failures.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  const elapsed = now - entry.firstAt;
  if (elapsed >= WINDOW_MS) {
    failures.delete(key);
    return null;
  }

  if (entry.count < MAX_FAILURES) {
    return null;
  }

  return Math.ceil((WINDOW_MS - elapsed) / 1000);
}

/** 记一次失败。 */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  prune(now);

  const key = keyOf(ip);
  const entry = failures.get(key);

  if (!entry || now - entry.firstAt >= WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: now });
    return;
  }

  entry.count += 1;
}

/** 登录成功，清掉该 IP 的失败计数。 */
export function clearLoginFailures(ip: string): void {
  failures.delete(keyOf(ip));
}

/** 测试用：清空全部计数。 */
export function resetLoginGuard(): void {
  failures.clear();
}
