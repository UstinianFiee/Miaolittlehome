import { revalidatePath } from "next/cache";

import { routing } from "@/i18n/routing";

/**
 * 文章 / 分类 / 设置等变更后的按需刷新（docs/SPEC.md 技术约束 1）。
 * 只刷新受影响的前台路径，不做整站重建。
 *
 * ## 踩过的坑：缓存标签里带**路由组**
 *
 * 实测 `/zh/about` 的缓存标签是：
 *
 * ```
 * _N_T_/layout
 * _N_T_/(site)/layout
 * _N_T_/(site)/[locale]/layout      ← 布局段叫 (site)/[locale]
 * _N_T_/(site)/[locale]/about/layout
 * _N_T_/(site)/[locale]/about/page
 * _N_T_/zh/about
 * ```
 *
 * 所以 `revalidatePath("/[locale]", "layout")` 生成的是 `_N_T_/[locale]/layout`，
 * 跟真实标签**对不上**，会**静默失效**——这就是「后台改了站点设置，只有首页生效、
 * 其他页面全是旧内容」的原因。必须带上路由组：`/(site)/[locale]`。
 *
 * ## 为什么统一用「布局刷」而不是逐个枚举路径
 *
 * 分页走的是路径段（`/page/N`、`/posts/page/N`），页数会随文章增减变化，
 * 逐个枚举既麻烦又必然漏（之前 `LIST_PATHS` 就漏掉了分页页）。
 * 布局刷一次覆盖所有前台页面，以后新增页面也不用再回来改这里。
 *
 * 代价是「任何一次后台改动都会让整个前台在下次访问时重新生成」。
 * 对个人博客完全可接受（前台本来就是 60 秒 ISR）。
 */

/** 前台静态页（不带语言前缀）。新增前台页面时补进来，作为布局刷的兜底。 */
const FRONT_STATIC_PATHS = [
  "",
  "/posts",
  "/shuoshuo",
  "/archive",
  "/categories",
  "/tags",
  "/albums",
  "/videos",
  "/software",
  "/wall",
  "/about",
  "/search",
];

/**
 * 数据写入已经提交，缓存刷新属于「尽力而为」。
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

/**
 * 刷新前台所有可缓存页面。
 *
 * @param extraPaths 需要额外刷新的具体路径（不带语言前缀），例如 `/posts/xxx`、`/albums/3`
 */
function revalidateFront(extraPaths: string[] = []): void {
  safeRevalidate(() => {
    // 1) 路由组布局一把刷：唯一能覆盖「所有前台页面」的写法
    revalidatePath("/(site)/[locale]", "layout");

    // 2) 兜底：再按真实路径显式刷一遍主要页面。
    //    万一以后路由组改名，上面那条会静默失效，这里至少保住主要内容。
    for (const locale of routing.locales) {
      for (const path of FRONT_STATIC_PATHS) {
        revalidatePath(`/${locale}${path}`);
      }
      for (const path of extraPaths) {
        revalidatePath(`/${locale}${path}`);
      }
    }

    // 3) sitemap 不在前台布局下，得单独刷（新增 / 删除文章后要能立刻反映）
    revalidatePath("/sitemap.xml");
  });
}

/** 文章新增 / 编辑 / 删除后刷新前台。 */
export function revalidatePost(slug?: string | null, previousSlug?: string | null): void {
  const extra: string[] = [];
  if (slug) {
    extra.push(`/posts/${slug}`);
  }
  if (previousSlug && previousSlug !== slug) {
    extra.push(`/posts/${previousSlug}`);
  }
  revalidateFront(extra);
}

/** 分类 / 标签变更后刷新前台（分类与标签详情页也由布局刷覆盖）。 */
export function revalidateTaxonomy(): void {
  revalidateFront();
}

/** 播放列表变更后刷新前台（播放器挂在站点布局里）。 */
export function revalidatePlaylist(): void {
  revalidateFront();
}

/** 站点信息变更后刷新前台（站点名出现在每页头部与页脚）。 */
export function revalidateSiteSettings(): void {
  revalidateFront();
}

/** 公告变更后刷新前台。 */
export function revalidateAnnouncements(): void {
  revalidateFront();
}

/** 说说变更后刷新前台（说说会夹杂在首页信息流里）。 */
export function revalidateShuoshuo(): void {
  revalidateFront(["/shuoshuo"]);
}

/** 关于页资料（头像 / 简介 / 社交 / 友链）变更后刷新前台（首页侧边栏也用到了它）。 */
export function revalidateProfile(): void {
  revalidateFront(["/about"]);
}

/** 视频变更后刷新前台。 */
export function revalidateVideos(videoId?: number): void {
  revalidateFront(videoId ? [`/videos/${videoId}`] : []);
}

/** 软件变更后刷新前台。 */
export function revalidateSoftware(softwareId?: number): void {
  revalidateFront(softwareId ? [`/software/${softwareId}`] : []);
}

/**
 * 评论审核 / 删除后刷新前台。
 * 只有「已审核」的评论会进入静态渲染，所以提交时无需刷新，审核时才有必要。
 */
export function revalidateComments(postSlug: string | null): void {
  revalidateFront(postSlug ? [`/posts/${postSlug}`] : []);
}

/** 媒体或相册变更后刷新前台相册页（含图片迁入 / 迁出的两侧相册）。 */
export function revalidateAlbums(albumIds: (number | null | undefined)[] = []): void {
  const ids = [...new Set(albumIds.filter((id): id is number => typeof id === "number"))];
  revalidateFront(ids.map((id) => `/albums/${id}`));
}
