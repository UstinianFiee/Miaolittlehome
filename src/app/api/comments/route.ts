import { NextResponse } from "next/server";

import {
  COMMENT_AUTHOR_MAX,
  COMMENT_CONTENT_MAX,
  COMMENT_RATE_LIMIT_SECONDS,
  createComment,
  findPostSlugById,
  findRecentCommentByHash,
  hashIp,
  validateParent,
  validateTarget,
  type CommentTarget,
} from "@/lib/comments";
import { clientIpFromHeaders, resolveIpRegion } from "@/lib/ip-region";
import { revalidateComments } from "@/lib/revalidate";
import { getSession } from "@/lib/session";
import { parseUserAgent } from "@/lib/user-agent";
import { errorResponse, optionalInt, optionalString, requireString } from "@/lib/validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 公开接口：提交评论或留言。访客一律待审；站长本人提交直接通过。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // 蜜罐：正常访客看不到该字段，被填写即视为机器人。
    // 返回「成功」但不入库，避免给爬虫反馈。
    const honeypot = typeof body.honeypot === "string" ? body.honeypot.trim() : "";
    if (honeypot.length > 0) {
      return NextResponse.json({ ok: true, data: null }, { status: 201 });
    }

    const scope = body.scope === "wall" ? "wall" : "post";
    const target: CommentTarget = {
      type: scope,
      refId: scope === "wall" ? null : optionalInt(body.refId, "文章"),
    };

    const validTarget = await validateTarget(target);
    if (!validTarget.ok) {
      return NextResponse.json({ ok: false, error: validTarget.message }, { status: 400 });
    }

    const parentId = optionalInt(body.parentId, "回复目标");
    if (parentId !== null) {
      const parent = await validateParent(target, parentId);
      if (!parent.ok) {
        return NextResponse.json({ ok: false, error: parent.message }, { status: 400 });
      }
    }

    const author = requireString(body.author, "昵称", { max: COMMENT_AUTHOR_MAX });

    const email = optionalString(body.email, "邮箱", 100);
    if (email && !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ ok: false, error: "邮箱格式不正确" }, { status: 400 });
    }

    const content = requireString(body.content, "评论内容", { max: COMMENT_CONTENT_MAX });

    // 站长登录状态下发言：标记 isAdmin 并直接通过审核
    const session = await getSession();
    const isAdmin = session !== null;

    const ip = clientIpFromHeaders(request.headers) || null;
    const ipHash = hashIp(ip);

    // 频率限制：同 IP 在窗口期内只允许一条（站长不受限）
    if (!isAdmin) {
      const recent = await findRecentCommentByHash(ipHash);
      if (recent) {
        return NextResponse.json(
          { ok: false, error: `提交过于频繁，请 ${COMMENT_RATE_LIMIT_SECONDS} 秒后再试` },
          { status: 429 }
        );
      }
    }

    const agent = parseUserAgent(request.headers.get("user-agent"));
    const rawUserAgent = (request.headers.get("user-agent") ?? "").slice(0, 500);

    const created = await createComment({
      type: target.type,
      refId: target.refId,
      parentId,
      author,
      email,
      content,
      // ua 存原始串，browser / os 存解析结果（与数据模型一致）
      ua: rawUserAgent,
      browser: agent?.browser ?? "",
      os: agent?.os ?? "",
      ipRegion: (ip ? resolveIpRegion(ip) : null) ?? "",
      ipHash,
      isAdmin,
      approved: isAdmin,
    });

    // 站长发言会直接通过审核并立即出现在页面上，需要刷新对应前台缓存
    if (created.approved) {
      revalidateComments(target.type === "post" ? await findPostSlugById(target.refId) : null);
    }

    // 不回传 email / ipHash，避免在响应里回显隐私字段
    return NextResponse.json(
      {
        ok: true,
        data: {
          id: created.id,
          author: created.author,
          content: created.content,
          ua: created.ua,
          browser: created.browser,
          os: created.os,
          ipRegion: created.ipRegion,
          isAdmin: created.isAdmin,
          approved: created.approved,
          parentId: created.parentId,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
