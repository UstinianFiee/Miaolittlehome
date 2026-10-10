import type { Metadata } from "next";

import {
  AnnouncementManager,
  type AnnouncementRow,
} from "@/components/admin/announcement-manager";
import { listAnnouncementsForAdmin } from "@/lib/announcements";
import { catalogs } from "@/lib/messages";

export const metadata: Metadata = {
  title: catalogs.zh.adminAnnouncements.title,
};

export default async function AdminAnnouncementsPage() {
  const items = await listAnnouncementsForAdmin();

  const rows: AnnouncementRow[] = items.map((item) => ({
    id: item.id,
    content: item.content,
    pinned: item.pinned,
    published: item.published,
    createdAt: item.createdAt.toISOString(),
  }));

  return <AnnouncementManager items={rows} />;
}
