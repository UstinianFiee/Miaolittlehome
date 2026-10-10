import type { Metadata } from "next";

import { LogViewer } from "@/components/admin/log-viewer";
import { catalogs } from "@/lib/messages";

export const metadata: Metadata = {
  title: catalogs.zh.adminLogs.title,
};

/** 日志中心：操作日志与访问记录的查看、筛选与手动清理。 */
export default function AdminLogsPage() {
  return <LogViewer />;
}
