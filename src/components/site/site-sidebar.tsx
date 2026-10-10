import { LinkIcon, UserIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AnnouncementBoard } from "@/components/site/announcement-board";
import { PostTabs } from "@/components/site/post-tabs";
import { ProfileIcon, iconLabel } from "@/components/site/profile-icon";
import { Link } from "@/i18n/navigation";
import { toAnnouncementViews } from "@/lib/announcement-view";
import { ANNOUNCEMENT_SIDEBAR_LIMIT, listPublishedAnnouncements } from "@/lib/announcements";
import { listFriends } from "@/lib/friends";
import { listPopularPosts, listRecentPosts, listTagsWithCount } from "@/lib/query";
import { getProfile, getSiteInfo, type ProfileLink } from "@/lib/settings";

const SIDEBAR_POST_LIMIT = 5;
const SIDEBAR_TAG_LIMIT = 18;

/** 邮箱图标允许只填地址，这里补上 mailto:；其余按原样使用。 */
function linkHref(link: ProfileLink): string {
  const url = link.url.trim();
  if (link.icon === "email" && !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return `mailto:${url}`;
  }
  return url;
}

/**
 * 列表页右侧栏：个人资料 + 最新/热点文章 + 标签聚合 + 友情链接。
 * 所有数据在服务端读取；仅「最新/热点」切换是客户端交互。
 */
export async function SiteSidebar({ locale }: { locale: string }) {
  const t = await getTranslations();

  const [profile, info, friends, tags, recent, popular, announcements, allAnnouncements] =
    await Promise.all([
      getProfile(),
      getSiteInfo(),
      listFriends(),
      listTagsWithCount(),
      listRecentPosts(SIDEBAR_POST_LIMIT),
      listPopularPosts(SIDEBAR_POST_LIMIT),
      listPublishedAnnouncements(ANNOUNCEMENT_SIDEBAR_LIMIT),
      listPublishedAnnouncements(),
    ]);

  const socials = profile.links;
  const visibleTags = tags.filter((tag) => tag._count.posts > 0).slice(0, SIDEBAR_TAG_LIMIT);

  // 个人显示名优先，未填则回退站点名
  const displayName = profile.name || info.name;

  return (
    <aside className="space-y-6">
      {/* 个人资料 */}
      <div className="surface p-5 text-center">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar}
            alt=""
            loading="lazy"
            className="mx-auto size-20 rounded-full border-2 border-primary/30 object-cover"
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
                className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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

      {/* 标签聚合 */}
      {visibleTags.length > 0 ? (
        <div className="surface p-5">
          <h2 className="section-title font-display">{t("sidebar.tags")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <Link key={tag.id} href={`/tags/${tag.slug}`} className="tag-pill">
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* 友情链接 */}
      {friends.length > 0 ? (
        <div className="surface p-5">
          <h2 className="section-title font-display">{t("sidebar.friends")}</h2>
          <ul className="mt-4 space-y-2.5">
            {friends.map((friend) => (
              <li key={friend.id}>
                <a
                  href={friend.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  title={friend.description ?? friend.name}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {friend.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friend.avatar}
                      alt=""
                      loading="lazy"
                      className="size-5 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <LinkIcon className="size-4 shrink-0" />
                  )}
                  <span className="truncate">{friend.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
