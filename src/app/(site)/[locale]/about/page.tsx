import { LinkIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";

import { ProfileIcon, iconLabel } from "@/components/site/profile-icon";
import { listFriends } from "@/lib/friends";
import { buildPageMetadata } from "@/lib/metadata";
import { getProfile, getSiteInfo, type ProfileLink } from "@/lib/settings";

type Props = { params: Promise<{ locale: string }> };

/** 邮箱图标允许只填地址，这里补上 mailto:；其余按原样使用。 */
function linkHref(link: ProfileLink): string {
  const url = link.url.trim();
  if (link.icon === "email" && !/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return `mailto:${url}`;
  }
  return url;
}

/**
 * 名片顶带的主题色占比。刻意用同一主题色的深浅变化，而不是按 id 派生随机色相 ——
 * 后者几张名片凑在一起是彩虹色，整页会显得"拼贴"（用户明确不喜欢这个）。
 */
const FRIEND_MIXES = ["45%", "62%", "78%"] as const;

function friendMix(id: number): string {
  return FRIEND_MIXES[id % FRIEND_MIXES.length];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/about", titleKey: "nav.about" });
}

/**
 * 关于页。
 *
 * 站点其它页面都有"物件感"（气泡、便利贴、小相册、录像带、书签），这一页原来是纯文字，
 * 显得很平。改造思路：
 * - 头部做成一张**签名卡**（`.about-card`）：顶部一条主题色渐变细线当页眉，
 *   头像外面套一圈主题色光环，悬停时光环向外扩散。
 * - 社交链接做成**胶囊**，悬停时图标弹一下（和复制成功、保存成功同一套反馈）。
 * - 友链做成**小名片**（`.friend-card`）：顶部一条按 id 派生色相的细带，悬停抬起。
 *
 * 全部颜色走主题变量 / `color-mix`，深浅主题自动跟随；没有引入任何依赖。
 */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const [profile, friends, info] = await Promise.all([getProfile(), listFriends(), getSiteInfo()]);

  // 个人显示名优先，未填则回退站点名
  const displayName = profile.name || info.name;
  const links = profile.links;

  const isEmpty = profile.bio === "" && links.length === 0 && friends.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      {/* 签名卡 */}
      <header className="about-card surface flex flex-col items-start gap-5 p-6 pt-7 sm:flex-row sm:items-center sm:gap-6 sm:p-7 sm:pt-8">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="about-avatar size-20 shrink-0 rounded-full object-cover sm:size-24"
          />
        ) : (
          <div className="about-avatar flex size-20 shrink-0 items-center justify-center rounded-full bg-muted/30 sm:size-24">
            <UserIcon className="size-8 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl">{displayName}</h1>
          {profile.bio ? (
            <p className="leading-8 text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
          ) : null}
        </div>
      </header>

      {links.length > 0 ? (
        <section className="mt-8 space-y-3" data-testid="social-section">
          <h2 className="section-title">{t("about.social")}</h2>
          <ul className="flex flex-wrap gap-2">
            {links.map((link, index) => (
              <li key={index}>
                <a
                  href={linkHref(link)}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="social-pill press inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-sm transition-colors hover:border-primary/45 hover:text-primary"
                >
                  <ProfileIcon name={link.icon} className="size-4 shrink-0" />
                  {link.label || iconLabel(link.icon)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 友链不填不显示 */}
      {friends.length > 0 ? (
        <section className="mt-10 space-y-3" data-testid="friends-section">
          <h2 className="section-title">
            {t("about.friends")}
            <span className="text-sm font-normal text-muted-foreground">{friends.length}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {friends.map((friend) => (
              <li key={friend.id}>
                <a
                  href={friend.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="friend-card group flex h-full items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-4 pt-5"
                  style={{ "--friend-mix": friendMix(friend.id) } as CSSProperties}
                >
                  {friend.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friend.avatar}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-11 shrink-0 rounded-full border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-sm font-medium">
                      {friend.name.slice(0, 1)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm underline-offset-4 group-hover:underline">
                      {friend.name}
                    </p>
                    {friend.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {friend.description}
                      </p>
                    ) : null}
                    <p className="mt-2 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                      <LinkIcon className="size-3 shrink-0" />
                      <span className="truncate">
                        {friend.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </span>
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isEmpty ? (
        <p className="empty-state mt-10 rounded-lg border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
          {t("about.empty")}
        </p>
      ) : null}
    </div>
  );
}
