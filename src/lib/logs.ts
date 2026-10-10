import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * 日志工具：操作日志（OperationLog）与访问记录（VisitLog）。
 * 保留期由 LOG_RETENTION_DAYS 控制（默认 7 天），采用「写入时惰性清理」，
 * 并做小时级节流，避免每次写入都全表扫描。
 */

const DEFAULT_RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let lastCleanupAt = 0;

export function logRetentionDays(): number {
  const raw = Number(process.env.LOG_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DAYS;
}

export function logRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - logRetentionDays() * 24 * 60 * 60 * 1000);
}

/** 删除超出保留期的日志；默认按小时节流，force=true 立即执行。 */
export async function cleanupLogs(
  force = false
): Promise<{ operations: number; visits: number }> {
  const now = Date.now();
  if (!force && now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return { operations: 0, visits: 0 };
  }
  lastCleanupAt = now;

  const cutoff = logRetentionCutoff();

  const [operations, visits] = await Promise.all([
    prisma.operationLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.visitLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);

  return { operations: operations.count, visits: visits.count };
}

export type OperationInput = {
  /** 机器可读的动作标识，例如 "auth.login" */
  action: string;
  target?: string | null;
  detail?: string | null;
};

/** 记录后台操作。日志失败不影响主流程。 */
export async function logOperation(input: OperationInput): Promise<void> {
  try {
    await prisma.operationLog.create({
      data: {
        action: input.action,
        target: input.target ?? null,
        detail: input.detail ?? null,
      },
    });
    await cleanupLogs();
  } catch (error) {
    console.error("[logs] 写入操作日志失败：", error);
  }
}

export type VisitInput = {
  path: string;
  ua?: string | null;
  referer?: string | null;
  /** 归属地由 ip2region 解析（阶段 10 接入），当前可为空 */
  ipRegion?: string | null;
};

/** 记录前台访问。日志失败不影响主流程。 */
export async function logVisit(input: VisitInput): Promise<void> {
  try {
    await prisma.visitLog.create({
      data: {
        path: input.path,
        ua: input.ua ?? null,
        referer: input.referer ?? null,
        ipRegion: input.ipRegion ?? null,
      },
    });
    await cleanupLogs();
  } catch (error) {
    console.error("[logs] 写入访问记录失败：", error);
  }
}

// ---------- 后台查询（阶段 15） ----------

export const LOG_PAGE_SIZE = 30;

export type LogKind = "operation" | "visit";

export type OperationLogFilter = {
  page: number;
  pageSize?: number;
  action?: string | null;
  keyword?: string | null;
};

export async function listOperationLogs(filter: OperationLogFilter) {
  const pageSize = filter.pageSize ?? LOG_PAGE_SIZE;

  const where: Prisma.OperationLogWhereInput = {};
  if (filter.action) {
    where.action = filter.action;
  }
  if (filter.keyword) {
    where.OR = [
      { target: { contains: filter.keyword } },
      { detail: { contains: filter.keyword } },
      { action: { contains: filter.keyword } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.operationLog.count({ where }),
    prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, items, pageSize };
}

export type VisitLogFilter = {
  page: number;
  pageSize?: number;
  keyword?: string | null;
};

export async function listVisitLogs(filter: VisitLogFilter) {
  const pageSize = filter.pageSize ?? LOG_PAGE_SIZE;

  const where: Prisma.VisitLogWhereInput = {};
  if (filter.keyword) {
    where.OR = [
      { path: { contains: filter.keyword } },
      { ipRegion: { contains: filter.keyword } },
      { ua: { contains: filter.keyword } },
      { referer: { contains: filter.keyword } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.visitLog.count({ where }),
    prisma.visitLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, items, pageSize };
}

/** 日志概览：总数、保留期、以及访问量最高的路径与归属地。 */
export async function logStats() {
  const cutoff = logRetentionCutoff();

  const [operations, visits, oldestOperation, oldestVisit] = await Promise.all([
    prisma.operationLog.count(),
    prisma.visitLog.count(),
    prisma.operationLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.visitLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  const [topPaths, topRegions] = await Promise.all([
    prisma.visitLog.groupBy({
      by: ["path"],
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 8,
    }),
    prisma.visitLog.groupBy({
      by: ["ipRegion"],
      _count: { ipRegion: true },
      orderBy: { _count: { ipRegion: "desc" } },
      take: 8,
    }),
  ]);

  return {
    operations,
    visits,
    retentionDays: logRetentionDays(),
    cutoff: cutoff.toISOString(),
    oldestOperationAt: oldestOperation?.createdAt.toISOString() ?? null,
    oldestVisitAt: oldestVisit?.createdAt.toISOString() ?? null,
    topPaths: topPaths.map((row) => ({ path: row.path, count: row._count.path })),
    topRegions: topRegions
      .filter((row) => row.ipRegion)
      .map((row) => ({ region: row.ipRegion as string, count: row._count.ipRegion })),
  };
}

/** 操作日志里出现过的 action 列表（用于筛选下拉）。 */
export async function listOperationActions() {
  const rows = await prisma.operationLog.groupBy({
    by: ["action"],
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
  });

  return rows.map((row) => ({ action: row.action, count: row._count.action }));
}
