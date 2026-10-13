import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { listAlbumsForSite } from "@/lib/query";

type AlbumsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: AlbumsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/albums", titleKey: "nav.albums" });
}

export default async function AlbumsPage({ params }: AlbumsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const albums = await listAlbumsForSite();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">{t("site.albumsTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("site.albumsHint")}</p>

      {albums.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("site.albumsEmpty")}</p>
      ) : (
        <ul className="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id}>
              <Link href={`/albums/${album.id}`} className="group block">
                {/*
                  小相册：封面照片后面压着两张（.album-stack 的伪元素），
                  悬停时散开 —— 像把一本相册从一摞照片里抽出来。
                */}
                <div className="album-stack">
                  <div className="media-zoom overflow-hidden rounded-md border border-border/60 bg-muted/30">
                    {album.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={album.cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted-foreground">
                        {t("site.photoCount", { count: 0 })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-1 px-1">
                  <p className="font-display text-base underline-offset-4 transition-colors group-hover:text-primary group-hover:underline">
                    {pickLocalized(locale, album.name, album.nameEn)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("site.photoCount", { count: album.count })}
                  </p>
                  {album.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {album.description}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
