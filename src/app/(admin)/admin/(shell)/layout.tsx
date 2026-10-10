import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { getSiteInfo } from "@/lib/settings";
import { getSession } from "@/lib/session";

/**
 * 后台受保护区域。
 * middleware 已做一次鉴权，这里再校验一次作为纵深防御
 * （避免将来 matcher 调整或新增入口时出现漏网）。
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  // 顶栏显示站点名与 Logo，和前台保持一致
  const { name, logo } = await getSiteInfo();

  return (
    <AdminShell siteName={name} logo={logo}>
      {children}
    </AdminShell>
  );
}
