import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PhotoGallery } from "@/components/site/photo-gallery";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { pickLocalized } from "@/lib/localized";
import { buildPageMetadata } from "@/lib/metadata";
import { getAlbumWithPhotos, listAlbumsForSite } from "@/lib/query";

type AlbumPageProps = { params: Promise<{ locale: string; id: string }> };

export async function generateStaticParams() {
  const albums = await listAlbumsForSite();

  return routing.locales.flatMap((locale) =>
    albums.map((album) => ({ locale, id: String(album.id) }))
  );
}

export async function generateMetadata({ params }: AlbumPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const album = await getAlbumWithPhotos(Number(id));

  if (!album) {
    return {};
  }

  return buildPageMetadata({ locale, path: `/albums/${album.id}`, titleKey: "nav.albums" });
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const albumId = Number(id);
  const album = Number.isInteger(albumId) ? await getAlbumWithPhotos(albumId) : null;

  if (!album) {
    // 走 notFound()：返回真正的 404 状态码，文案在同级 not-found.tsx 里
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-6 space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/albums">
            <ArrowLeftIcon className="size-4" />
            {t("site.albumsTitle")}
          </Link>
        </Button>
        <h1 className="font-display text-2xl">
          {pickLocalized(locale, album.name, album.nameEn)}
        </h1>
        {album.description ? (
          <p className="text-muted-foreground">{album.description}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("site.photoCount", { count: album.photos.length })}
        </p>
      </header>

      <PhotoGallery photos={album.photos} />
    </div>
  );
}
