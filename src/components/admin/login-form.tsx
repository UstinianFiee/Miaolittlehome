"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ElevatorField } from "@/components/ui/elevator-field";
import { Input } from "@/components/ui/input";
import { Tick } from "@/components/ui/tick";
import { passwordStrength, STRENGTH_COLORS } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

/** 停止输入后多久开始「批改」（毫秒）。太短会边打边闪，太长显得迟钝。 */
const CHECK_DELAY_MS = 620;

export function LoginForm({ siteName, logo }: { siteName: string; logo?: string }) {
  const t = useTranslations();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  // 两个字段的「批改结果」：只在停止输入一段时间后才置位
  const [usernameOk, setUsernameOk] = React.useState(false);
  const [passwordOk, setPasswordOk] = React.useState(false);

  // 出错时让框体轻晃；靠先关后开重播动画
  const [shaking, setShaking] = React.useState(false);
  // 出错后红框保持到用户重新输入，别一晃就没了
  const [failed, setFailed] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);

  const strength = React.useMemo(() => passwordStrength(password), [password]);

  // 水合完成前禁用提交：避免未挂载时退化成原生表单提交（会把密码写进 URL）
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 暂停输入后校验：像老师等学生写完再打勾
  React.useEffect(() => {
    if (!username) {
      setUsernameOk(false);
      return;
    }
    const timer = window.setTimeout(() => setUsernameOk(username.trim().length > 0), CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [username]);

  React.useEffect(() => {
    if (!password) {
      setPasswordOk(false);
      return;
    }
    const timer = window.setTimeout(() => setPasswordOk(password.length >= 6), CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [password]);

  function triggerShake() {
    setShaking(false);
    // 等一帧再打开，否则 class 没被移除过、动画不会重播
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShaking(true));
    });
    window.setTimeout(() => setShaking(false), 560);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
      // 框体轻晃是主要反馈；下面那行文字只作为补充说明
      setFailed(true);
      triggerShake();
    } catch {
      setError(t("login.genericError"));
      setFailed(true);
      triggerShake();
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
        className="space-y-5"
      >
        <ElevatorField
          id="username"
          label={t("login.username")}
          shake={shaking}
          invalid={failed}
          adornment={usernameOk && !failed ? <Tick /> : null}
        >
          <Input
            id="username"
            name="username"
            placeholder=" "
            autoComplete="username"
            required
            maxLength={64}
            autoFocus
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setFailed(false);
            }}
            className={cn(
              "pr-9 transition-shadow duration-300",
              "focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]",
              failed && "border-destructive focus-visible:border-destructive"
            )}
          />
        </ElevatorField>

        <div>
          <ElevatorField
            id="password"
            label={t("login.password")}
            shake={shaking}
            invalid={failed}
            adornment={
              <>
                {passwordOk && !failed ? (
                  <Tick />
                ) : password ? (
                  <span
                    className="text-xs font-medium"
                    style={{ color: STRENGTH_COLORS[strength.level] }}
                  >
                    {t(`login.${strength.labelKey}`)}
                  </span>
                ) : null}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={reveal ? t("login.hidePassword") : t("login.showPassword")}
                  onClick={() => setReveal((current) => !current)}
                  className="press rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {reveal ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </>
            }
          >
            <Input
              id="password"
              name="password"
              type={reveal ? "text" : "password"}
              placeholder=" "
              autoComplete="current-password"
              required
              maxLength={200}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFailed(false);
              }}
              className={cn(
                "pr-16 transition-shadow duration-300",
                "focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]",
                failed && "border-destructive focus-visible:border-destructive"
              )}
            />
          </ElevatorField>

          {/*
            密码强度温度计：液柱整条铺满渐变、靠 clip-path 裁出长度，
            所以强度越高露出来的部分越往红端走 —— 视觉上就是温度在升。
          */}
          <div className="thermo" aria-hidden>
            <div className="thermo-track">
              <div
                className="thermo-fill"
                style={{ clipPath: `inset(0 ${100 - strength.score}% 0 0)` }}
              />
            </div>
            <span
              className="thermo-bulb"
              style={{
                left: `${strength.score}%`,
                backgroundColor: STRENGTH_COLORS[strength.level],
                boxShadow:
                  strength.level > 0
                    ? `0 0 10px ${STRENGTH_COLORS[strength.level]}, 0 0 4px ${STRENGTH_COLORS[strength.level]}`
                    : "none",
              }}
            />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="page-enter flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <span aria-hidden className="mt-px">
              !
            </span>
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          aria-busy={pending}
          className="press ripple h-11 w-full"
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
