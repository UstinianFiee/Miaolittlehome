import { PassThrough, Readable } from "node:stream";

import { NextResponse } from "next/server";

import { BackupError, backupFileName, prepareBackup, writePreparedArchive } from "@/lib/backup";
import { logOperation } from "@/lib/logs";

/**
 * 导出内容备份。
 *
 * `?media=0` 排除媒体文件，`?software=1` 带上软件安装包（默认不带，动辄上 G）。
 *
 * 分两步：**先预检再写流**。一旦开始写响应体，状态码就定死了，
 * 那时才发现超限只能让用户下到一个坏包，所以预检失败要在返回 200 之前拦住。
 *
 * 流式输出，不在内存里攒整包 —— 浏览器原生下载，自带进度条。
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const media = params.get("media") !== "0";
  const software = params.get("software") === "1";

  let prepared;
  try {
    prepared = await prepareBackup({ media, software });
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[backup] 导出预检失败：", error);
    return NextResponse.json({ ok: false, error: "导出失败" }, { status: 500 });
  }

  const fileName = backupFileName();
  const stream = new PassThrough();

  void writePreparedArchive(stream, prepared)
    .then(() =>
      logOperation({
        action: "backup_export",
        target: fileName,
        detail:
          `文章 ${prepared.summary.counts.posts} · 说说 ${prepared.summary.counts.shuoshuo} · ` +
          `文件 ${prepared.summary.files.media + prepared.summary.files.software}`,
      })
    )
    .catch((error) => {
      // 客户端中途取消下载也会走到这里，只记录，不当成服务端故障
      console.error("[backup] 导出中断：", error);
      stream.destroy(error instanceof Error ? error : new Error("导出失败"));
    });

  return new Response(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
