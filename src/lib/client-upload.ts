"use client";

/**
 * 分片上传的客户端逻辑（媒体库与软件安装包共用）。
 * init → chunk(可多片) → complete；不做断点续传。
 */

export type ChunkEndpoints = {
  init: string;
  chunk: string;
  complete: string;
};

export type UploadOutcome =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export async function uploadFileInChunks(
  file: File,
  endpoints: ChunkEndpoints,
  extra: Record<string, unknown> = {},
  onProgress?: (percent: number) => void
): Promise<UploadOutcome> {
  const initResponse = await fetch(endpoints.init, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, size: file.size }),
  });

  if (!initResponse.ok) {
    return { ok: false, message: await readError(initResponse, "init") };
  }

  const init = (await initResponse.json()) as {
    data?: { uploadId: string; chunkSize: number; totalChunks: number };
  };

  const plan = init.data;
  if (!plan) {
    return { ok: false, message: "init" };
  }

  for (let index = 0; index < plan.totalChunks; index += 1) {
    const start = index * plan.chunkSize;
    const blob = file.slice(start, Math.min(start + plan.chunkSize, file.size));

    const chunkResponse = await fetch(endpoints.chunk, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-upload-id": plan.uploadId,
        "x-chunk-index": String(index),
      },
      body: blob,
    });

    if (!chunkResponse.ok) {
      return { ok: false, message: await readError(chunkResponse, "chunk") };
    }

    onProgress?.(Math.round(((index + 1) / plan.totalChunks) * 100));
  }

  const completeResponse = await fetch(endpoints.complete, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uploadId: plan.uploadId,
      fileName: file.name,
      size: file.size,
      totalChunks: plan.totalChunks,
      ...extra,
    }),
  });

  if (!completeResponse.ok) {
    return { ok: false, message: await readError(completeResponse, "complete") };
  }

  return { ok: true, data: (await completeResponse.json().catch(() => null))?.data ?? null };
}
