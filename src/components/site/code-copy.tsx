"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import * as React from "react";

/**
 * 给正文里的代码块加「复制」按钮。
 *
 * 做成独立的增强脚本而不是改 Markdown 管线：文章 HTML 由服务端生成并直接注入，
 * 这里在挂载后给每个 `<pre>` 包一层容器再塞按钮，**不参与 hydration**，
 * 也不会把文章 HTML 重复塞进客户端负载。
 *
 * 依赖 pathname 重新执行——文章之间是客户端路由切换，DOM 会换掉。
 */
export function CodeCopy() {
  const t = useTranslations();
  const pathname = usePathname();
  const labels = React.useRef({ copy: "", copied: "" });

  labels.current = { copy: t("code.copy"), copied: t("code.copied") };

  React.useEffect(() => {
    const blocks = document.querySelectorAll<HTMLPreElement>(".markdown-body pre");
    const cleanups: (() => void)[] = [];

    for (const pre of blocks) {
      // 幂等：已经处理过的跳过
      if (pre.parentElement?.classList.contains("code-block")) {
        continue;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy";
      button.textContent = labels.current.copy;
      button.setAttribute("aria-label", labels.current.copy);

      let timer: number | undefined;
      const onClick = async () => {
        const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
        const ok = await copyText(code);
        button.textContent = ok ? labels.current.copied : labels.current.copy;
        button.classList.toggle("is-copied", ok);
        button.setAttribute("aria-label", button.textContent ?? "");

        if (timer) {
          window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
          button.textContent = labels.current.copy;
          button.classList.remove("is-copied");
        }, 1600);
      };

      button.addEventListener("click", onClick);
      wrapper.appendChild(button);

      cleanups.push(() => {
        if (timer) {
          window.clearTimeout(timer);
        }
        button.removeEventListener("click", onClick);
      });
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [pathname]);

  return null;
}

/**
 * 复制文本。
 * `navigator.clipboard` 只在安全上下文可用（http + 非 localhost 会缺失），
 * 因此保留 textarea + execCommand 的老办法兜底。
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兜底
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
