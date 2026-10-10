import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { BuiltinLanguage } from "shiki";
import { unified } from "unified";

/**
 * Markdown → HTML 渲染管线（docs/SPEC.md 技术约束：remark/rehype + Shiki，构建期高亮）。
 *
 * - 在服务端（SSG / ISR）执行，客户端零渲染开销
 * - 代码块由 Shiki 高亮，输出「浅色 / 深色」双主题 CSS 变量（见 globals.css）
 * - 未列入 HIGHLIGHT_LANGS 的语言会被 Shiki 原样保留，不会报错
 *
 * 说明：文章内容由单管理员撰写，属于可信输入，因此不做 HTML 清洗
 * （清洗会破坏 Shiki 生成的 class 与 style）。若将来渲染访客输入（如评论），
 * 必须另行走清洗流程。
 */

const HIGHLIGHT_LANGS: BuiltinLanguage[] = [
  "bash",
  "css",
  "diff",
  "docker",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "nginx",
  "prisma",
  "python",
  "rust",
  "sql",
  "tsx",
  "typescript",
  "vue",
  "yaml",
];

const THEMES = { light: "github-light", dark: "github-dark" };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeShiki, {
    themes: THEMES,
    // 只输出 CSS 变量，由 globals.css 按 .dark 切换
    defaultColor: false,
    langs: HIGHLIGHT_LANGS,
  })
  .use(rehypeStringify);

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 把 Markdown 渲染为 HTML。失败时降级为纯文本，避免整页报错。 */
export async function renderMarkdown(source: string): Promise<string> {
  try {
    const file = await processor.process(source);
    return String(file);
  } catch (error) {
    console.error("[markdown] 渲染失败，降级为纯文本：", error);
    return `<pre><code>${escapeHtml(source)}</code></pre>`;
  }
}

/** 纯文本摘要：从 Markdown 内容里提取一段可读文字（列表页兜底用）。 */
export function excerptFromMarkdown(source: string, length = 120): string {
  const plain = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > length ? `${plain.slice(0, length)}…` : plain;
}
