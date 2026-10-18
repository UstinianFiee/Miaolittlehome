import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { LoginForm } from "@/components/admin/login-form";
import { Particles } from "@/components/site/particles";
import { ThemeToggle } from "@/components/theme-toggle";
import { catalogs } from "@/lib/messages";
import { getSiteInfo } from "@/lib/settings";

// 后台不参与语言路由，服务端直接取中文文案（文案仍统一维护在 messages/zh.json）
export const metadata: Metadata = {
  title: catalogs.zh.login.title,
};

export default async function AdminLoginPage() {
  // 背景与前台首页保持一致（都取站点设置里的背景图）
  const { name, logo, background } = await getSiteInfo();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {background ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url("${background}")` }}
          />
          <div aria-hidden className="hero-veil absolute inset-0 -z-10" />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1000px 520px at 50% 0%, color-mix(in oklab, var(--brand) 22%, transparent), transparent 70%)",
          }}
        />
      )}

      <Particles className="pointer-events-none absolute inset-0 -z-10 size-full" />

      {/* 主题切换：登录页不在 AdminShell 里，单独放一个，否则深色系统下进不去浅色 */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* 返回前台：后台不参与语言路由，这里用 next/link */}
      <NextLink
        href="/"
        className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {catalogs.zh.admin.backToSite}
      </NextLink>

      <Suspense fallback={null}>
        <LoginForm siteName={name} logo={logo} />
      </Suspense>
    </div>
  );
}
