import crypto from "node:crypto";

import type { CommentType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * 评论数据层（docs/SPEC.md）。
 * - 先审后显：approved=false 的评论对访客不可见
 * - 两层嵌套：顶层评论 + 回复；回复的父评论不可见时整条隐藏
 * - 反垃圾：同 IP（哈希后）频率限制 + 表单蜜罐（蜜罐在接口层处理）
 *
 * 注意：数据模型里没有 postId/albumId，而是 type + refId；
 * 也没有 nickname，而是 author；IP 不落库，只存 ipHash（仅用于限频）。
 */

export const COMMENT_CONTENT_MAX = 1000;
export const COMMENT_AUTHOR_MAX = 30;
export const COMMENT_RATE_LIMIT_SECONDS = Number(process.env.COMMENT_RATE_LIMIT_SECONDS ?? "60");
export const COMMENT_ADMIN_PAGE_SIZE = 20;

export type CommentTarget = { type: CommentType; refId: number | null };

export type CommentRecord = {
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
  createdAt: Date;
};

export type CommentNode = CommentRecord & { replies: CommentNode[] };

const commentSelect = {
  id: true,
  type: true,
  refId: true,
  author: true,
  content: true,
  ua: true,
  browser: true,
  os: true,
  ipRegion: true,
  isAdmin: true,
  approved: true,
  parentId: true,
  createdAt: true,
} satisfies Prisma.CommentSelect;

function targetWhere(target: CommentTarget): Prisma.CommentWhereInput {
  return { type: target.type, refId: target.refId };
}

/** 组装两层评论树：顶层 + 回复。 */
function buildTree(rows: CommentRecord[]): CommentNode[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const roots: CommentNode[] = [];
  const rootById = new Map<number, CommentNode>();

  for (const row of rows) {
    if (row.parentId === null) {
      const node: CommentNode = { ...row, replies: [] };
      roots.push(node);
      rootById.set(row.id, node);
    }
  }

  for (const row of rows) {
    if (row.parentId === null) {
      continue;
    }

    // 向上找到根评论；父评论不可见（未审核/已删除）时整条回复隐藏
    let ancestor = byId.get(row.parentId);
    let guard = 0;
    while (ancestor && ancestor.parentId !== null && guard < 5) {
      ancestor = byId.get(ancestor.parentId);
      guard += 1;
    }

    const root = ancestor ? rootById.get(ancestor.id) : undefined;
    if (!root) {
      continue;
    }

    root.replies.push({ ...row, replies: [] });
  }

  return roots;
}

/** 访客可见的评论（仅已审核）。 */
export async function listApprovedComments(target: CommentTarget): Promise<CommentNode[]> {
  const rows = await prisma.comment.findMany({
    where: { ...targetWhere(target), approved: true },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });

  return buildTree(rows);
}

/** 留言墙每页条数。 */
export const WALL_PAGE_SIZE = 12;

/**
 * 留言墙专用：**顶层留言按时间倒序分页**（最新的在最前），并带上各自的所有回复。
 *
 * 和 `listApprovedComments` 的区别不只是排序：
 * - 那里是「一次取全部再组装树」，留言一多就会无限变长；
 * - 这里先只取一页顶层（一个 IN 查询带出它们的回复），树只在这一页内组装。
 *
 * 回复仍然按时间**升序**（先说的话在前面），符合阅读习惯。
 */
export async function listWallComments(params: { page?: number; pageSize?: number } = {}) {
  const pageSize = params.pageSize ?? WALL_PAGE_SIZE;
  const page = Math.max(1, Math.floor(params.page ?? 1));

  const where: Prisma.CommentWhereInput = {
    type: "wall",
    refId: null,
    parentId: null,
    approved: true,
  };

  const [total, roots] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: commentSelect,
    }),
  ]);

  const replies = roots.length
    ? await prisma.comment.findMany({
        where: { parentId: { in: roots.map((root) => root.id) }, approved: true },
        orderBy: { createdAt: "asc" },
        select: commentSelect,
      })
    : [];

  return {
    total,
    items: buildTree([...roots, ...replies]),
    page,
    pageSize,
  };
}

export type CreateCommentInput = {
  type: CommentType;
  refId: number | null;
  parentId: number | null;
  author: string;
  email: string | null;
  content: string;
  ua: string;
  browser: string;
  os: string;
  ipRegion: string;
  ipHash: string | null;
  isAdmin: boolean;
  approved: boolean;
};

export async function createComment(input: CreateCommentInput) {
  return prisma.comment.create({
    data: input,
    select: commentSelect,
  });
}

/** 校验评论目标：留言墙不需要目标；文章评论要求文章已发布。 */
export async function validateTarget(
  target: CommentTarget
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (target.type === "wall") {
    return { ok: true };
  }

  if (target.refId === null) {
    return { ok: false, message: "缺少文章标识" };
  }

  const post = await prisma.post.findFirst({
    where: { id: target.refId, published: true },
    select: { id: true },
  });

  return post ? { ok: true } : { ok: false, message: "文章不存在或未发布" };
}

/** 父评论必须存在、已审核，且只允许回复顶层评论。 */
export async function validateParent(
  target: CommentTarget,
  parentId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parent = await prisma.comment.findFirst({
    where: { id: parentId, ...targetWhere(target), approved: true },
    select: { id: true, parentId: true },
  });

  if (!parent) {
    return { ok: false, message: "要回复的评论不存在" };
  }

  if (parent.parentId !== null) {
    return { ok: false, message: "只支持回复顶层评论" };
  }

  return { ok: true };
}

/** IP 只以哈希形式保存，用于限频（docs/SPEC.md 数据模型注释）。 */
export function hashIp(ip: string | null): string | null {
  if (!ip) {
    return null;
  }
  const salt = process.env.IP_HASH_SALT ?? "blog-comment-rate-limit";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** 频率限制：同一 IP 在窗口期内是否已有提交。 */
export async function findRecentCommentByHash(
  ipHash: string | null,
  windowSeconds = COMMENT_RATE_LIMIT_SECONDS
) {
  if (!ipHash || windowSeconds <= 0) {
    return null;
  }

  const since = new Date(Date.now() - windowSeconds * 1000);

  return prisma.comment.findFirst({
    where: { ipHash, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
}

// ---------- 后台 ----------

export type AdminCommentStatus = "pending" | "approved" | "all";

export async function listCommentsForAdmin(params: {
  status: AdminCommentStatus;
  page: number;
  pageSize?: number;
}) {
  const pageSize = params.pageSize ?? COMMENT_ADMIN_PAGE_SIZE;

  const where: Prisma.CommentWhereInput =
    params.status === "pending"
      ? { approved: false }
      : params.status === "approved"
        ? { approved: true }
        : {};

  const [total, rows] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * pageSize,
      take: pageSize,
      select: { ...commentSelect, email: true },
    }),
  ]);

  // Comment 与 Post 之间没有外键关系（用 type + refId 关联），这里单独查标题
  const postIds = [...new Set(rows.filter((row) => row.type === "post").map((row) => row.refId))].filter(
    (id): id is number => typeof id === "number"
  );

  const posts = postIds.length
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, title: true, slug: true },
      })
    : [];
  const postById = new Map(posts.map((post) => [post.id, post]));

  const items = rows.map((row) => ({
    ...row,
    refType: row.type as CommentType,
    refId: row.refId,
    post: row.type === "post" && row.refId !== null ? postById.get(row.refId) ?? null : null,
  }));

  return { total, items, pageSize };
}

export async function countCommentsByStatus() {
  const [pending, approved, total] = await Promise.all([
    prisma.comment.count({ where: { approved: false } }),
    prisma.comment.count({ where: { approved: true } }),
    prisma.comment.count(),
  ]);

  return { pending, approved, total };
}

export async function setCommentApproved(id: number, approved: boolean) {
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, type: true, refId: true, author: true },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { approved },
    select: { id: true, approved: true },
  });

  return { ...updated, refType: existing.type, refId: existing.refId, author: existing.author };
}

export async function deleteComment(id: number) {
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, type: true, refId: true, author: true },
  });

  if (!existing) {
    return null;
  }

  // parent 关系配置了 onDelete: Cascade，删除父评论会一并删除回复
  await prisma.comment.delete({ where: { id } });
  return { ...existing, refType: existing.type };
}

/** 文章 slug（用于后台跳转与前台缓存刷新）。 */
export async function findPostSlugById(postId: number | null): Promise<string | null> {
  if (postId === null) {
    return null;
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { slug: true } });
  return post?.slug ?? null;
}

export async function countCommentsForTarget(target: CommentTarget): Promise<number> {
  return prisma.comment.count({ where: { ...targetWhere(target), approved: true } });
}
