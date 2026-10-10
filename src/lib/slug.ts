import { prisma } from "@/lib/prisma";

/**
 * slug 规则（docs/SPEC.md 技术约束 18）：
 * - 英文/数字 → kebab-case
 * - 纯中文等无法转换时 → 回退「日期-短随机串」
 * - 唯一冲突 → 追加 -2、-3 …
 * - 不引入拼音库
 */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function dateStamp(date: Date = new Date()): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
}

/** 中日韩文字：用于判断标题是否以非拉丁字符为主。 */
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

/** 含 CJK 的标题，若转换后只剩很短的拉丁片段（如「验证标签A」→「a」），视为无意义。 */
const MIN_MEANINGFUL_LENGTH = 3;

function deriveSlug(source: string): string {
  const slug = slugify(source);

  if (!slug) {
    return "";
  }

  // 混合标题里拉丁部分过短时，宁可回退到日期+随机串，也不生成 "a" 这种 slug
  if (CJK_PATTERN.test(source) && slug.length < MIN_MEANINGFUL_LENGTH) {
    return "";
  }

  return slug;
}

/** 文章的 slug 基值：优先用用户填写的，其次由标题推导，最后回退。 */
export function postSlugBase(title: string, provided?: string | null): string {
  const fromProvided = provided ? deriveSlug(provided) : "";
  if (fromProvided) {
    return fromProvided;
  }

  const fromTitle = deriveSlug(title);
  return fromTitle || `post-${dateStamp()}-${randomSuffix()}`;
}

export function tagSlugBase(name: string): string {
  const fromName = deriveSlug(name);
  return fromName || `tag-${dateStamp()}-${randomSuffix()}`;
}

/** 在 posts 表中保证 slug 唯一；excludeId 用于编辑时排除自身。 */
export async function uniquePostSlug(base: string, excludeId?: number): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const existing = await prisma.post.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/** 在 tags 表中保证 slug 唯一。 */
export async function uniqueTagSlug(base: string, excludeId?: number): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const existing = await prisma.tag.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
