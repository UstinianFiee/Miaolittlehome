import { prisma } from "@/lib/prisma";

/**
 * 播放列表（docs/SPEC.md 阶段 12）。
 * 存在 Setting 表的 `playlist` 键里，值为 JSON 数组，前台播放器直接读取。
 */

export const PLAYLIST_KEY = "playlist";
export const PLAYLIST_MAX_TRACKS = 100;

export type PlaylistTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover: string | null;
};

export class PlaylistError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PlaylistError";
    this.status = status;
  }
}

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 宽松解析：单条损坏不影响整体，直接跳过。 */
export function parsePlaylist(raw: string | null | undefined): PlaylistTrack[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const tracks: PlaylistTrack[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as Record<string, unknown>;
      const src = asText(record.src, 500);
      if (!src) {
        continue;
      }

      tracks.push({
        id: asText(record.id, 64) || `track-${tracks.length + 1}`,
        title: asText(record.title, 100) || "未命名",
        artist: asText(record.artist, 100),
        src,
        cover: asText(record.cover, 500) || null,
      });
    }

    return tracks.slice(0, PLAYLIST_MAX_TRACKS);
  } catch {
    return [];
  }
}

/** 严格校验：来自后台提交的数据，非法直接报错。 */
export function validatePlaylist(input: unknown): PlaylistTrack[] {
  if (!Array.isArray(input)) {
    throw new PlaylistError("播放列表格式不正确");
  }

  if (input.length > PLAYLIST_MAX_TRACKS) {
    throw new PlaylistError(`播放列表最多 ${PLAYLIST_MAX_TRACKS} 首`);
  }

  return input.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new PlaylistError(`第 ${index + 1} 条格式不正确`);
    }

    const record = item as Record<string, unknown>;
    const title = asText(record.title, 100);
    const src = asText(record.src, 500);

    if (!title) {
      throw new PlaylistError(`第 ${index + 1} 条缺少标题`);
    }
    if (!src) {
      throw new PlaylistError(`第 ${index + 1} 条缺少音频地址`);
    }
    if (!/^(https?:\/\/|\/)/i.test(src)) {
      throw new PlaylistError(`第 ${index + 1} 条的音频地址需以 / 或 http(s):// 开头`);
    }

    return {
      id: asText(record.id, 64) || `track-${index + 1}`,
      title,
      artist: asText(record.artist, 100),
      src,
      cover: asText(record.cover, 500) || null,
    };
  });
}

export async function getPlaylist(): Promise<PlaylistTrack[]> {
  const row = await prisma.setting.findUnique({
    where: { key: PLAYLIST_KEY },
    select: { value: true },
  });

  return parsePlaylist(row?.value);
}

export async function savePlaylist(tracks: PlaylistTrack[]): Promise<void> {
  const value = JSON.stringify(tracks);

  await prisma.setting.upsert({
    where: { key: PLAYLIST_KEY },
    update: { value },
    create: { key: PLAYLIST_KEY, value },
  });
}
