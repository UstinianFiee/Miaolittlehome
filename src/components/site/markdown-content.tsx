/**
 * 渲染 Markdown 生成的 HTML。
 * 内容来源是单管理员撰写的文章（可信输入），且由 src/lib/markdown.ts 生成，
 * 因此这里直接注入；访客输入（评论等）不得走这条路径。
 */
export function MarkdownContent({ html }: { html: string }) {
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
