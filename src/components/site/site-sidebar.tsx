import { UserIcon } from "lucide-react";

import { AnnouncementBoard } from "@/components/site/announcement-board";
import { PostTabs } from "@/components/site/post-tabs";
import { ProfileIcon, iconLabel } from "@/components/site/profile-icon";
import { resizedImageUrl } from "@/lib/image-url";
import { toAnnouncementViews } from "@/lib/announcement-view";
import { ANNOUNCEMENT_SIDEBAR_LIMIT, listPublishedAnnouncements } from "@/lib/announcements";
import { listPopularPosts, listRecentPosts } from "@/lib/query";
import { getProfile, getSiteInfo, type ProfileLink } from "@/lib/settings";

const SIDEBAR_POST_LIMIT = 5;

/** 邮箱图标允许只填地址，这里补上 mailto:；其余按原样使用。 */
function linkHref(link: ProfileLink): string {
  const url = link.url.trim();
  if (link.icon === "email" && !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return `mailto:${url}`;
  }
  return url;
}

/**
 * 列表页右侧栏：个人资料 + 公告 + 最新/热点文章。
 * 所有数据在服务端读取；仅「最新/热点」切换是客户端交互。
 *
 * 2026-10-27：去掉「标签聚合」和「友情链接」两张卡片 —— 首页侧栏固定三张卡片，
 * 高度正好落在视口内，不再出现侧栏内部滚动条；标签/友链本身仍可从导航进入。
 */
export async function SiteSidebar({ locale }: { locale: string }) {
  const [profile, info, recent, popular, announcements, allAnnouncements] =
    await Promise.all([
      getProfile(),
      getSiteInfo(),
      listRecentPosts(SIDEBAR_POST_LIMIT),
      listPopularPosts(SIDEBAR_POST_LIMIT),
      listPublishedAnnouncements(ANNOUNCEMENT_SIDEBAR_LIMIT),
      listPublishedAnnouncements(),
    ]);

  const socials = profile.links;

  // 个人显示名优先，未填则回退站点名
  const displayName = profile.name || info.name;

  return (
    /*
     * 桌面端让侧栏跟着滚动（sticky）：
     * 列表页左边信息流比侧栏长，侧栏滚出视口后右边会留一大片空白，看起来像"下面没内容了"。
     * 侧栏本身可能比视口高（首页约 900px+），所以给 max-height + 内部滚动，
     * 避免 sticky 后底部的卡片永远看不到；手机端不启用（仍在正文下方）。
     */
    <aside className="sidebar-stagger space-y-6 lg:sticky lg:top-[6.5rem] lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      {/* 个人资料 */}
      <div className="surface p-5 text-center">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resizedImageUrl(profile.avatar, 256)}
            alt=""
            loading="lazy"
            className="mx-auto size-20 rounded-full border-2 border-brand/40 object-cover ring-4 ring-brand/10"
          />
        ) : (
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border-2 border-border bg-muted/40">
            <UserIcon className="size-8 text-muted-foreground" />
          </div>
        )}

        <p className="font-display mt-3 text-base">{displayName}</p>

        {profile.bio ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
        ) : null}

        {socials.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {socials.map((item, index) => (
              <a
                key={index}
                href={linkHref(item)}
                target="_blank"
                rel="nofollow noopener noreferrer"
                aria-label={item.label || iconLabel(item.icon)}
                title={item.label || iconLabel(item.icon)}
                className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-brand hover:text-primary"
              >
                <ProfileIcon name={item.icon} className="size-4" />
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {/* 公告 */}
      <AnnouncementBoard
        items={toAnnouncementViews(announcements)}
        allItems={toAnnouncementViews(allAnnouncements)}
        total={allAnnouncements.length}
      />

      {/* 最新 / 热点文章 */}
      <PostTabs recent={recent} popular={popular} locale={locale} />
    </aside>
  );
}
