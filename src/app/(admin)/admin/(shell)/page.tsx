import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { formatDual } from "@/lib/datetime";
import { catalogs } from "@/lib/messages";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: catalogs.zh.admin.nav.dashboard,
};

export default async function AdminDashboardPage() {
  const [
    posts,
    publishedPosts,
    shuoshuo,
    publishedShuoshuo,
    comments,
    pendingComments,
    media,
    friends,
    operations,
  ] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { published: true } }),
      prisma.shuoshuo.count(),
      prisma.shuoshuo.count({ where: { published: true } }),
      prisma.comment.count(),
      prisma.comment.count({ where: { approved: false } }),
      prisma.media.count(),
      prisma.friend.count(),
      prisma.operationLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return (
    <AdminDashboard
      stats={[
        { labelKey: "admin.dashboard.posts", value: posts, hintKey: "admin.dashboard.published", hintValue: publishedPosts },
        {
          labelKey: "admin.dashboard.pendingComments",
          value: pendingComments,
          hintKey: "admin.dashboard.totalComments",
          hintValue: comments,
        },
        { labelKey: "admin.dashboard.shuoshuo", value: shuoshuo, hintKey: "admin.dashboard.published", hintValue: publishedShuoshuo },
        { labelKey: "admin.dashboard.media", value: media },
        { labelKey: "admin.dashboard.friends", value: friends },
      ]}
      operations={operations.map((item) => ({
        id: item.id,
        action: item.action,
        target: item.target,
        createdAt: formatDual(item.createdAt),
      }))}
    />
  );
}
