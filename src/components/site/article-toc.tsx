import type { MarkdownHeading } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * 文章目录（放在正文右侧的粘性侧栏里）。
 *
 * 锚点直接取自 `rehype-slug` 在正文里生成的真实 id（见 `extractMarkdownHeadings`），
 * 所以不会出现「目录的 slug 与正文对不上」这类问题。
 *
 * 做成服务端组件（无 hooks、无客户端 JS）：目录内容在构建 / ISR 时就定了，
 * 没必要为它额外发一段客户端脚本。
 */
export function ArticleToc({
  headings,
  title,
}: {
  headings: MarkdownHeading[];
  title: string;
}) {
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label={title} className="surface p-4">
      <h2 className="section-title text-sm">{title}</h2>

      {/* 左侧一条细导轨 + 按层级缩进，层级一眼分得清 */}
      <ol className="mt-3 space-y-0.5 border-l border-border/70 pl-2.5">
        {headings.map((heading, index) => (
          <li key={`${heading.id}-${index}`}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "block min-w-0 rounded px-2 py-1 text-[0.8rem] leading-[1.6] break-words transition-colors",
                "text-muted-foreground hover:bg-primary/8 hover:text-primary",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                heading.depth === 3 && "pl-3.5",
                heading.depth >= 4 && "pl-6"
              )}
            >
              {heading.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
