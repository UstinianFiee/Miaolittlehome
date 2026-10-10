import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/login-form";
import { Particles } from "@/components/site/particles";
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
              "radial-gradient(1000px 520px at 50% 0%, color-mix(in oklab, var(--primary) 26%, transparent), transparent 70%)",
          }}
        />
      )}

      <Particles className="pointer-events-none absolute inset-0 -z-10 size-full" />

      <Suspense fallback={null}>
        <LoginForm siteName={name} logo={logo} />
      </Suspense>
    </div>
  );
}
