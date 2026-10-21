import type { CommentNode } from "@/lib/comments";

/**
 * 评论的服务端视图模型：把数据库记录转成可传给客户端组件的形式。
 * 时间只带 ISO 字符串，界面统一交给 `<DualTime>` 渲染（见 dual-time.tsx）。
 *
 * 这里只有类型与纯函数，客户端组件用 `import type` 引用，不会把 Prisma 带进浏览器包。
 */
export type CommentView = {
  id: number;
  author: string;
  content: string;
  /**
   * 完整原始 UA —— **服务端视图永远不填充，请勿在 `toView` 里加回来**。
   *
   * 背景：UA 是可指纹化数据，前台只展示 `browser` / `os` 摘要（见
   * `comment-section.tsx` 的 `<Meta>`），没有任何渲染逻辑需要原始串；
   * 若在 `toView` 填充，它会被序列化进每个访客拿到的 RSC payload，
   * 等于把全部评论者的完整 UA 下发给所有人。
   *
   * 为什么字段还保留为可选、而不是直接删掉：`comment-section.tsx` 用
   * `Omit<CommentView, "replies">` 派生出客户端本地待审记录 `PendingComment`，
   * 并在提交成功后把接口返回的 `ua` 写进去（那是「提交者自己的 UA」，
   * 只存在他自己的 localStorage 里，不涉及他人隐私）。该客户端文件不在本次
   * 改动范围，删字段会触发 TS 多余属性错误（excess property）。
   *
   * 后续清理建议：把 `PendingComment` 改成不依赖 `CommentView` 的独立类型
   * （或去掉它里面的 ua），然后删除本字段。
   */
  ua?: string;
  browser: string;
  os: string;
  ipRegion: string;
  isAdmin: boolean;
  approved: boolean;
  parentId: number | null;
  createdAtIso: string;
  replies: CommentView[];
};

function toView(node: CommentNode): CommentView {
  return {
    id: node.id,
    author: node.author,
    content: node.content,
    // 刻意不下发 rawUserAgent：前台只展示 browser/os 摘要
    browser: node.browser,
    os: node.os,
    ipRegion: node.ipRegion,
    isAdmin: node.isAdmin,
    approved: node.approved,
    parentId: node.parentId,
    createdAtIso: node.createdAt.toISOString(),
    replies: node.replies.map(toView),
  };
}

export function toCommentViews(nodes: CommentNode[]): CommentView[] {
  return nodes.map(toView);
}

/** 含回复的总条数。 */
export function countCommentViews(nodes: CommentView[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countCommentViews(node.replies), 0);
}
