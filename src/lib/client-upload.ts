"use client";

/**
 * 分片上传的客户端逻辑（媒体库与软件安装包共用）。
 * init → chunk(可多片) → complete；不做断点续传。
 *
 * 这里统一兜住网络异常：所有 fetch 失败都会转成 `{ ok:false, message }`，
 * 调用方只处理返回值即可，不需要再各自写 try/catch。
 */

export type ChunkEndpoints = {
  init: string;
  chunk: string;
  complete: string;
};

export type UploadOutcome =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

/** 单个分片的超时：8MB 分片在慢速移动网络下也够用。 */
const CHUNK_TIMEOUT_MS = 120 * 1000;
/** init 只写一个临时目录，响应很快。 */
const INIT_TIMEOUT_MS = 30 * 1000;
/** 分片失败后的重试次数（不含第一次）。 */
const MAX_RETRIES = 2;
/** 重试退避：第 1 次 800ms，第 2 次 2000ms。 */
const RETRY_DELAYS_MS = [800, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function timeoutError(): Error {
  const error = new Error("请求超时，请检查网络后重试");
  error.name = "TimeoutError";
  return error;
}

/** 带超时的 fetch；超时抛中文错误，便于直接展示给管理员。 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw timeoutError();
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function isNetworkError(error: unknown): boolean {
  // fetch 在网络中断时抛 TypeError；我们自己的超时抛 TimeoutError。
  if (error instanceof TypeError) {
    return true;
  }
  return error instanceof Error && error.name === "TimeoutError";
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

function errorMessage(error: unknown): string {
  // fetch 网络错误抛 TypeError，默认文案是 "Failed to fetch"，换成中文
  if (error instanceof TypeError) {
    return "网络连接失败，请检查网络后重试";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "上传失败，请重试";
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? fallback;
}

/**
 * 上传单个分片，网络错误/5xx 自动重试。
 * 4xx 属于内容或参数问题，不重试，交给上层读取错误信息。
 */
async function postChunk(
  endpoints: ChunkEndpoints,
  uploadId: string,
  index: number,
  blob: Blob
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      // 指数退避，给网络抖动一点恢复时间
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 2000);
    }

    try {
      const response = await fetchWithTimeout(
        endpoints.chunk,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-upload-id": uploadId,
            "x-chunk-index": String(index),
          },
          body: blob,
        },
        CHUNK_TIMEOUT_MS
      );

      if (response.ok || !isRetryableStatus(response.status) || attempt === MAX_RETRIES) {
        return response;
      }
      // 5xx：继续下一次重试
    } catch (error) {
      if (!isNetworkError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      // 网络错误/超时：继续下一次重试
    }
  }

  throw new Error("分片上传失败，请重试");
}

export async function uploadFileInChunks(
  file: File,
  endpoints: ChunkEndpoints,
  extra: Record<string, unknown> = {},
  onProgress?: (percent: number) => void
): Promise<UploadOutcome> {
  try {
    const initResponse = await fetchWithTimeout(
      endpoints.init,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      },
      INIT_TIMEOUT_MS
    );

    if (!initResponse.ok) {
      return { ok: false, message: await readError(initResponse, "上传初始化失败") };
    }

    const init = (await initResponse.json()) as {
      data?: { uploadId: string; chunkSize: number; totalChunks: number };
    };

    const plan = init.data;
    if (!plan) {
      return { ok: false, message: "上传初始化失败，请重试" };
    }

    for (let index = 0; index < plan.totalChunks; index += 1) {
      const start = index * plan.chunkSize;
      const blob = file.slice(start, Math.min(start + plan.chunkSize, file.size));

      const chunkResponse = await postChunk(endpoints, plan.uploadId, index, blob);

      if (!chunkResponse.ok) {
        return { ok: false, message: await readError(chunkResponse, "分片上传失败") };
      }

      onProgress?.(Math.round(((index + 1) / plan.totalChunks) * 100));
    }

    // complete 可能要合并大文件/解压备份，服务端耗时不可控，所以不加超时
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
      // 服务端 complete 的失败分支会清理临时分片（各上传路由自己处理）
      return { ok: false, message: await readError(completeResponse, "保存上传结果失败") };
    }

    return { ok: true, data: (await completeResponse.json().catch(() => null))?.data ?? null };
  } catch (error) {
    /*
     * 客户端目前没有 discard 接口（本阶段白名单只允许改后台页面和日志 API），
     * 中断后残留的临时分片由服务端 chunked-upload.ts 的 24h sweep 回收。
     * 这里保证：不把异常抛给 UI，并给出可读中文提示。
     */
    return { ok: false, message: errorMessage(error) };
  }
}
