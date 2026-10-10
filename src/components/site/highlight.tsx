import type { ReactNode } from "react";

/**
 * 把文本中命中查询词的部分包成 <mark>。
 * 构造的是 React 节点而不是 HTML 字符串，因此不存在注入风险。
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) {
    return <>{text}</>;
  }

  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();

  const parts: ReactNode[] = [];
  let cursor = 0;
  let found = haystack.indexOf(target, cursor);
  let key = 0;

  while (found !== -1) {
    if (found > cursor) {
      parts.push(text.slice(cursor, found));
    }
    parts.push(
      <mark key={key} className="rounded bg-primary/20 px-0.5 text-foreground">
        {text.slice(found, found + target.length)}
      </mark>
    );
    key += 1;
    cursor = found + target.length;
    found = haystack.indexOf(target, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}
