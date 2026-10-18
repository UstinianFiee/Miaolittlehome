"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations();
  const [pending, setPending] = React.useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      // 与登录同理：整页跳转保证 Cookie 的清除立即生效
      window.location.replace("/admin/login");
      return;
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={pending}
      aria-label={t("actions.logout")}
      title={t("actions.logout")}
      className="px-2 sm:px-3"
    >
      <LogOutIcon className="size-4" />
      <span className="hidden sm:inline">{t("actions.logout")}</span>
    </Button>
  );
}
