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
  ua: string;
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
    ua: node.ua,
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
