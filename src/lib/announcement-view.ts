import { formatDual } from "@/lib/datetime";

/**
 * 公告的服务端视图模型。
 * 单独成模块（非 "use client"），这样服务端页面能拿到真正的转换函数，
 * 客户端组件只 import type。
 */
export type AnnouncementView = {
  id: number;
  content: string;
  pinned: boolean;
  createdAtIso: string;
  createdAtLabel: string;
};

export function toAnnouncementViews(
  rows: { id: number; content: string; pinned: boolean; createdAt: Date }[]
): AnnouncementView[] {
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    pinned: row.pinned,
    createdAtIso: row.createdAt.toISOString(),
    createdAtLabel: formatDual(row.createdAt),
  }));
}
