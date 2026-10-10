import { NextResponse } from "next/server";

import { cleanupLogs, logOperation, logRetentionDays } from "@/lib/logs";
import { errorResponse } from "@/lib/validation";

/** 手动清理：删除超出保留期的日志（惰性清理之外的手动入口）。 */
export async function POST() {
  try {
    const retentionDays = logRetentionDays();
    const result = await cleanupLogs(true);

    await logOperation({
      action: "logs_cleanup",
      target: `${retentionDays} 天`,
      detail: `清理操作日志 ${result.operations} 条、访问记录 ${result.visits} 条`,
    });

    return NextResponse.json({ ok: true, data: { ...result, retentionDays } });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
