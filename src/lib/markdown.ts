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

/**
 * 允许出现在链接/图片里的协议。
 *
 * remark-rehype 默认会丢弃原始 HTML（`<script>` 进不来），但 Markdown 的
 * `[文案](javascript:...)` / `![图](data:...)` 会被原样转成 href/src。
 * 这里不做整体 HTML 清洗（会把 Shiki 的 class/style 洗掉），只把**协议**收紧。
 */
const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
/** 控制字符：`java\nscript:` 这类绕过必须在判断协议前先拦掉 */
const CONTROL_CHARS_PATTERN = /[\u0000-\u001f\u007f]/;

/** 最小的 hast 节点形状（只覆盖本插件用到的字段，避免依赖 @types/hast）。 */
type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function sanitizeUrl(raw: unknown, allowDataImage: boolean): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!value || CONTROL_CHARS_PATTERN.test(value)) {
    return null;
  }
  // 协议相对地址（//evil.com）会跳出本站，直接拒绝
  if (value.startsWith("//")) {
    return null;
  }
  if (!URL_SCHEME_PATTERN.test(value)) {
    // 无协议：站内相对路径、锚点
    return value;
  }

  const scheme = value.slice(0, value.indexOf(":") + 1).toLowerCase();
  if (SAFE_URL_SCHEMES.has(scheme)) {
    return value;
  }
  // 图片额外允许内联 data:image/*
  if (allowDataImage && scheme === "data:" && /^data:image\//i.test(value)) {
    return value;
  }
  return null;
}

function sanitizeHastNode(node: HastNode): void {
  if ((node.tagName === "a" || node.tagName === "img") && node.properties) {
    const key = node.tagName === "a" ? "href" : "src";
    if (node.properties[key] !== undefined) {
      const safe = sanitizeUrl(node.properties[key], node.tagName === "img");
      if (safe === null) {
        // 置空而不是删掉属性：链接/图片仍然保留结构，只是不再可跳转/加载
        node.properties[key] = "";
      } else {
        node.properties[key] = safe;
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      sanitizeHastNode(child);
    }
  }
}

/** 只清洗 a/img 的 href/src，不做整体 HTML 清洗。 */
function rehypeSafeUrls(): (tree: unknown) => void {
  return (tree: unknown): void => {
    sanitizeHastNode(tree as HastNode);
  };
}

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
  .use(rehypeSafeUrls)
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

export type MarkdownHeading = { depth: 2 | 3 | 4; id: string; label: string };

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_match, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/** 从已渲染 HTML 提取带 rehype-slug 实际锚点的目录，避免目录 slug 与正文不一致。 */
export function extractMarkdownHeadings(html: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const pattern = /<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;

  for (const match of html.matchAll(pattern)) {
    const depth = Number(match[1]) as MarkdownHeading["depth"];
    const id = match[2].match(/\bid="([^"]+)"/i)?.[1];
    const label = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();

    if (id && label) {
      headings.push({ depth, id: decodeHtmlEntities(id), label });
    }
  }

  return headings;
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
