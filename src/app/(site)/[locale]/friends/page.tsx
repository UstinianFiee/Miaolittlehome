import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FriendsOrbit } from "@/components/site/friends-orbit";
import { listFriends } from "@/lib/friends";
import { buildPageMetadata } from "@/lib/metadata";
import { getSiteInfo } from "@/lib/settings";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/friends", titleKey: "nav.friends" });
}

export default async function FriendsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, friends, site] = await Promise.all([
    getTranslations(),
    listFriends(),
    getSiteInfo(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-8 pb-4 sm:px-6 sm:pt-10">
      <header className="page-heading space-y-2 text-center">
        <h1 className="font-display text-3xl text-[color:var(--card-foreground)] sm:text-4xl">
          {t("friends.title")}
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
          {t("friends.subtitle")}
        </p>
      </header>

      {/* 手机端是纵向列表，靠上排；桌面端星系在剩余空间里居中 */}
      <div className="flex w-full flex-1 flex-col justify-start py-6 sm:justify-center">
        <FriendsOrbit
          friends={friends}
          siteName={site.name}
          logo={site.logo}
          emptyLabel={t("friends.empty")}
          visitLabel={(name) => t("friends.visit", { name })}
        />
      </div>
    </div>
  );
}
