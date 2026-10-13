import { UserIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProfileIcon, iconLabel } from "@/components/site/profile-icon";
import { Badge } from "@/components/ui/badge";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/about", titleKey: "nav.about" });
}

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
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="size-20 shrink-0 rounded-full border border-border/60 object-cover"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30">
            <UserIcon className="size-8 text-muted-foreground" />
          </div>
        )}

        <div className="space-y-2">
          <h1 className="font-display text-2xl">{displayName}</h1>
          {profile.bio ? (
            <p className="text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
          ) : null}
        </div>
      </header>

      {links.length > 0 ? (
        <section className="mt-8 space-y-3" data-testid="social-section">
          <h2 className="text-sm font-medium">{t("about.social")}</h2>
          <ul className="flex flex-wrap gap-2">
            {links.map((link, index) => (
              <li key={index}>
                <a
                  href={linkHref(link)}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:text-primary"
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
          <h2 className="text-sm font-medium">
            {t("about.friends")} · {friends.length}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {friends.map((friend) => (
              <li key={friend.id}>
                <a
                  href={friend.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="group flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40"
                >
                  {friend.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friend.avatar}
                      alt=""
                      loading="lazy"
                      className="size-10 shrink-0 rounded-full border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-sm font-medium">
                      {friend.name.slice(0, 1)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium underline-offset-4 group-hover:underline">
                      {friend.name}
                    </p>
                    {friend.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {friend.description}
                      </p>
                    ) : null}
                    <Badge variant="outline" className="mt-1.5">
                      {friend.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </Badge>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isEmpty ? (
        <p className="mt-10 rounded-lg border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
          {t("about.empty")}
        </p>
      ) : null}
    </div>
  );
}
