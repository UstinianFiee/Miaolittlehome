"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

/**
 * 站点配置同步器（不渲染任何东西）。
 *
 * ## 解决什么问题
 *
 * 后台改了站点设置（比如内容区背景图）之后：
 * - 服务端：`revalidatePath` 会把 ISR 缓存刷掉 ✓
 * - 浏览器：**客户端路由缓存不会被清掉** ✗
 *
 * 所以用户回到前台整页加载能看到新背景，但点导航/分页切过去，
 * 拿到的还是改动前那份预取数据 —— 表现就是「首页变了，后面的页面还是旧的」。
 * 这是 Next.js 的已知限制（`revalidatePath` 只在 Server Action 里才会把失效信息
 * 回传给客户端），官方给的解法就是在客户端调用 `router.refresh()`。
 *
 * ## 怎么做的
 *
 * 布局把**渲染时的配置版本号**传进来，这里向 `/api/site-version` 问一次当前值：
 * - 一样 → 什么都不做（正常情况，配置没改）
 * - 不一样 → `router.refresh()` 拉一份新的，当前路由连同布局一起重新渲染
 *
 * `router.refresh()` 之后新 HTML 会带上新版本号，下一轮自然就相等了。
 * 另外用 `refreshedFor` 兜底：同一个版本号只刷一次，避免服务端异常时反复刷新。
 */
export function ConfigSync({ version }: { version: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshedFor, setRefreshedFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (refreshedFor === version) {
      return;
    }

    let cancelled = false;

    fetch("/api/site-version", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { version?: string } | null) => {
        if (cancelled || !data?.version) {
          return;
        }
        if (data.version !== version) {
          // 记下「已经为这个版本刷过」，避免刷新后服务端仍返回旧值时死循环
          setRefreshedFor(version);
          router.refresh();
        }
      })
      .catch(() => {
        // 网络异常时静默放弃：这只是锦上添花，不该影响页面
      });

    return () => {
      cancelled = true;
    };
  }, [version, pathname, refreshedFor, router]);

  return null;
}
