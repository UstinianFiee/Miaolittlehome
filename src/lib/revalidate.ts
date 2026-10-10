import { revalidatePath } from "next/cache";

import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";

/**
 * 文章发布/编辑/删除后的按需刷新（docs/SPEC.md 技术约束 1）。
 * 只刷新受影响的前台路径，不做整站重建。
 *
 * 注意：数据写入已经提交，缓存刷新属于「尽力而为」。
 * 若刷新抛错就返回 500，客户端可能误判失败并重试，从而产生重复数据，
 * 因此这里捕获并记录，不影响写入结果。
 */
function safeRevalidate(run: () => void): void {
  try {
    run();
  } catch (error) {
    console.error("[revalidate] 前台缓存刷新失败：", error);
  }
}

const LIST_PATHS = ["", "/posts", "/archive", "/categories", "/tags"];

export function revalidatePost(slug?: string | null, previousSlug?: string | null): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      for (const path of LIST_PATHS) {
        revalidatePath(`/${locale}${path}`);
      }

      if (slug) {
        revalidatePath(`/${locale}/posts/${slug}`);
      }
      if (previousSlug && previousSlug !== slug) {
        revalidatePath(`/${locale}/posts/${previousSlug}`);
      }
    }
  });
}

/** 分类/标签变更后刷新相关列表页。 */
export function revalidateTaxonomy(): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      for (const path of LIST_PATHS) {
        revalidatePath(`/${locale}${path}`);
      }
    }
  });
}

/** 播放列表变更后刷新前台页面（播放器挂在站点布局里，刷新布局即可）。 */
export function revalidatePlaylist(): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}`, "layout");
    }
  });
}

/**
 * 站点信息变更后刷新前台布局（站点名出现在每页头部与页脚）。
 *
 * 注意：`[locale]` 是动态段，用具体路径 + "layout" 不会刷新布局缓存；
 * 必须按路由模式 `/[locale]` 指定，才能覆盖所有语言下的布局。
 *
 * 文章详情页有独立的背景设置（site.postBackground），但
 * `revalidatePath("/[locale]/posts/[slug]", "page")` 这种**多段动态模式**实测不生效，
 * 因此改为查出所有已发布 slug、逐条按真实路径刷新。
 */
export async function revalidateSiteSettings(): Promise<void> {
  let slugs: string[] = [];
  try {
    const posts = await prisma.post.findMany({
      where: { published: true },
      select: { slug: true },
    });
    slugs = posts.map((post) => post.slug);
  } catch (error) {
    console.error("[revalidate] 读取文章 slug 失败，跳过文章详情页刷新：", error);
  }

  safeRevalidate(() => {
    revalidatePath("/[locale]", "layout");

    // 布局之外的静态页面也一并刷新，避免首页等内容残留旧信息
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}`);

      for (const slug of slugs) {
        revalidatePath(`/${locale}/posts/${slug}`);
      }
    }
  });
}

/** 公告变更后刷新首页。 */
export function revalidateAnnouncements(): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}`);
    }
  });
}

/** 关于页资料（头像/简介/社交/友链）变更后刷新关于页与首页。 */
export function revalidateProfile(): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/about`);
      revalidatePath(`/${locale}`);
    }
  });
}

/** 视频变更后刷新视频列表与对应详情页。 */
export function revalidateVideos(videoId?: number): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/videos`);
      revalidatePath(`/${locale}/search`);
      if (videoId) {
        revalidatePath(`/${locale}/videos/${videoId}`);
      }
    }
  });
}

/** 软件变更后刷新软件列表与对应详情页。 */
export function revalidateSoftware(softwareId?: number): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/software`);
      revalidatePath(`/${locale}/search`);
      if (softwareId) {
        revalidatePath(`/${locale}/software/${softwareId}`);
      }
    }
  });
}

/**
 * 评论审核/删除后刷新对应前台页面。
 * 只有「已审核」的评论会进入静态渲染，所以提交时无需刷新，审核时才有必要。
 */
export function revalidateComments(postSlug: string | null): void {
  safeRevalidate(() => {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/wall`);
      if (postSlug) {
        revalidatePath(`/${locale}/posts/${postSlug}`);
      }
    }
  });
}

/**
 * 媒体或相册变更后刷新前台相册页。
 * 相册详情是动态路由，需要按具体 id 刷新（含图片迁入/迁出的两侧相册）。
 */
export function revalidateAlbums(albumIds: (number | null | undefined)[] = []): void {
  safeRevalidate(() => {
    const ids = [...new Set(albumIds.filter((id): id is number => typeof id === "number"))];

    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/albums`);
      for (const id of ids) {
        revalidatePath(`/${locale}/albums/${id}`);
      }
    }
  });
}
