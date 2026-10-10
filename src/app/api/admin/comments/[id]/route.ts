import { NextResponse } from "next/server";

import { deleteComment, findPostSlugById, setCommentApproved } from "@/lib/comments";
import { logOperation } from "@/lib/logs";
import { revalidateComments } from "@/lib/revalidate";
import { errorResponse } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的评论 id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const approved = body.approved === true;

    const updated = await setCommentApproved(id, approved);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "评论不存在" }, { status: 404 });
    }

    revalidateComments(updated.refType === "post" ? await findPostSlugById(updated.refId) : null);
    await logOperation({
      action: approved ? "comment_approve" : "comment_reject",
      target: `#${updated.id}`,
      detail: updated.author,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await resolveId(params);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "无效的评论 id" }, { status: 400 });
  }

  const deleted = await deleteComment(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "评论不存在" }, { status: 404 });
  }

  revalidateComments(deleted.refType === "post" ? await findPostSlugById(deleted.refId) : null);
  await logOperation({
    action: "comment_delete",
    target: `#${deleted.id}`,
    detail: deleted.author,
  });

  return NextResponse.json({ ok: true, data: { id } });
}
