"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ siteName, logo }: { siteName: string; logo?: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 水合完成前禁用提交：避免未挂载时退化成原生表单提交（会把密码写进 URL）
  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(formData.get("username") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
      });

      if (response.ok) {
        const from = searchParams.get("from");
        const target = from && from.startsWith("/admin") ? from : "/admin";
        // 用整页跳转（而不是 router.replace + router.refresh）：
        // 登录刚写下的 Cookie 必须在「下一次真实导航」里带上，
        // 客户端路由跳转容易命中 RSC 缓存、或被 middleware 再次弹回登录页，
        // 表现为「接口 200 但页面没反应」。整页跳转最稳，代价只是一次导航。
        window.location.replace(target);
        return;
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(
        response.status === 429
          ? t("login.tooManyAttempts")
          : data?.error === "invalid_credentials"
            ? t("login.invalidCredentials")
            : t("login.genericError")
      );
    } catch {
      setError(t("login.genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-enter w-full max-w-sm rounded-2xl border border-white/20 bg-card/65 p-7 shadow-2xl backdrop-blur-xl">
      <div className="mb-7 space-y-1.5 text-center">
        {/* 站点 Logo：没设置时回退成一个主题色圆点，避免头部空一块 */}
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="mx-auto mb-3 size-14 rounded-xl border border-white/20 object-cover shadow-lg"
          />
        ) : (
          <span
            aria-hidden
            className="mx-auto mb-3 block size-3 rounded-full bg-primary ring-4 ring-primary/20"
          />
        )}
        <p className="text-[0.7rem] tracking-[0.3em] text-muted-foreground uppercase">{siteName}</p>
        <h1 className="font-display text-2xl">{t("login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        // 兜底：即便脚本未加载，也用 POST 提交到接口，绝不让密码进入 URL
        method="post"
        action="/api/admin/login"
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="username">{t("login.username")}</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            required
            maxLength={64}
            autoFocus
            className="h-11 transition-shadow duration-300 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("login.password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            className="h-11 transition-shadow duration-300 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          aria-busy={pending}
          className="btn-gradient press ripple h-11 w-full"
          disabled={pending || !mounted}
        >
          {pending ? (
            <span className="loading-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          ) : (
            t("login.submit")
          )}
        </Button>
      </form>
    </div>
  );
}
