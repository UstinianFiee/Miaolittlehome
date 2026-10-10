import { pickLocalized } from "@/lib/localized";
import { prisma } from "@/lib/prisma";

/**
 * 全局搜索（docs/SPEC.md 阶段 11）：跨类型检索文章、相册、视频、软件。
 *
 * 实现说明：
 * - 直接使用 SQLite 的 LIKE（Prisma `contains`），不引入独立搜索服务
 *   （SPEC 把 Meilisearch 列为「后期可选」）
 * - SQLite 的 LIKE 会把 % 与 _ 当通配符，而 Prisma 不提供 ESCAPE 能力，
 *   因此取回结果后按字面量再过滤一次，保证「搜什么就是什么」
 * - 只检索已发布内容
 */

export type SearchResultType = "post" | "album" | "video" | "software";

export type SearchHit = {
  type: SearchResultType;
  id: number;
  title: string;
  summary: string;
  /** 不含语言前缀，由 Link 补全 */
  href: string;
  cover: string | null;
  meta: string | null;
};

export type SearchGroup = { type: SearchResultType; hits: SearchHit[] };

export type SearchOutcome = {
  query: string;
  total: number;
  groups: SearchGroup[];
};

/** 每类最多返回多少条 */
export const SEARCH_PER_TYPE = 8;

/** 命中后展示的摘要长度 */
const SUMMARY_LENGTH = 120;

function literalMatch(haystack: string | null | undefined, needle: string): boolean {
  return typeof haystack === "string" && haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * SQLite 的 LIKE 把 % 与 _ 当通配符。
 * 查询里不含通配符时 LIKE 等价于字面匹配，可以直接信任数据库结果；
 * 含通配符时改为按字面量复核（文章正文没有取回，因此这种情况下不参与复核）。
 */
const WILDCARD_PATTERN = /[%_]/;

function clip(text: string, length = SUMMARY_LENGTH): string {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > length ? `${plain.slice(0, length)}…` : plain;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function searchAll(rawQuery: string, locale: string): Promise<SearchOutcome> {
  const query = rawQuery.trim();
  if (query.length === 0) {
    return { query: "", total: 0, groups: [] };
  }

  // 多取一些，抵消 LIKE 通配符带来的误命中
  const take = SEARCH_PER_TYPE * 3;

  const [posts, albums, videos, software] = await Promise.all([
    prisma.post.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { content: { contains: query } },
          { slug: { contains: query } },
        ],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        title: true,
        titleEn: true,
        slug: true,
        summary: true,
        summaryEn: true,
        cover: true,
        createdAt: true,
        category: { select: { name: true, nameEn: true } },
      },
    }),
    prisma.album.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { nameEn: { contains: query } },
          { description: { contains: query } },
        ],
      },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        cover: true,
        media: {
          where: { type: "image" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { path: true, thumb: true },
        },
        _count: { select: { media: { where: { type: "image" } } } },
      },
    }),
    prisma.video.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: query } },
          { titleEn: { contains: query } },
          { description: { contains: query } },
        ],
      },
      orderBy: [{ pinned: "desc" }, { sort: "asc" }, { createdAt: "desc" }],
      take,
      select: { id: true, title: true, titleEn: true, description: true, cover: true, createdAt: true },
    }),
    prisma.software.findMany({
      where: {
        published: true,
        OR: [
          { name: { contains: query } },
          { nameEn: { contains: query } },
          { description: { contains: query } },
        ],
      },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        icon: true,
        createdAt: true,
      },
    }),
  ]);

  const hasWildcard = WILDCARD_PATTERN.test(query);

  const postHits: SearchHit[] = posts
    .filter(
      (post) =>
        !hasWildcard ||
        [post.title, post.titleEn, post.summary, post.summaryEn, post.slug].some((value) =>
          literalMatch(value, query)
        )
    )
    .slice(0, SEARCH_PER_TYPE)
    .map((post) => ({
      type: "post" as const,
      id: post.id,
      title: pickLocalized(locale, post.title, post.titleEn),
      summary: clip(pickLocalized(locale, post.summary, post.summaryEn)),
      href: `/posts/${post.slug}`,
      cover: post.cover,
      meta: [post.category ? pickLocalized(locale, post.category.name, post.category.nameEn) : null, formatDate(post.createdAt)]
        .filter(Boolean)
        .join(" · "),
    }));

  const albumHits: SearchHit[] = albums
    .filter((album) => [album.name, album.nameEn, album.description].some((value) => literalMatch(value, query)))
    .slice(0, SEARCH_PER_TYPE)
    .map((album) => ({
      type: "album" as const,
      id: album.id,
      title: pickLocalized(locale, album.name, album.nameEn),
      summary: clip(album.description ?? ""),
      href: `/albums/${album.id}`,
      cover: album.cover ?? album.media[0]?.thumb ?? album.media[0]?.path ?? null,
      meta: null,
    }));

  const videoHits: SearchHit[] = videos
    .filter((video) => [video.title, video.titleEn, video.description].some((value) => literalMatch(value, query)))
    .slice(0, SEARCH_PER_TYPE)
    .map((video) => ({
      type: "video" as const,
      id: video.id,
      title: pickLocalized(locale, video.title, video.titleEn),
      summary: clip(video.description ?? ""),
      href: `/videos/${video.id}`,
      cover: video.cover,
      meta: formatDate(video.createdAt),
    }));

  const softwareHits: SearchHit[] = software
    .filter((item) => [item.name, item.nameEn, item.description].some((value) => literalMatch(value, query)))
    .slice(0, SEARCH_PER_TYPE)
    .map((item) => ({
      type: "software" as const,
      id: item.id,
      title: pickLocalized(locale, item.name, item.nameEn),
      summary: clip(item.description),
      href: `/software/${item.id}`,
      cover: item.icon,
      meta: null,
    }));

  const groups: SearchGroup[] = (
    [
      { type: "post" as const, hits: postHits },
      { type: "album" as const, hits: albumHits },
      { type: "video" as const, hits: videoHits },
      { type: "software" as const, hits: softwareHits },
    ] satisfies SearchGroup[]
  ).filter((group) => group.hits.length > 0);

  const total = groups.reduce((sum, group) => sum + group.hits.length, 0);

  return { query, total, groups };
}
