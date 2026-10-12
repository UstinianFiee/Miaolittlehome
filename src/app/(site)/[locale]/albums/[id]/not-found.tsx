import { EntityNotFound } from "@/components/site/entity-not-found";

/** 相册不存在：返回真正的 404 状态码。 */
export default function AlbumNotFound() {
  return (
    <EntityNotFound
      messageKey="site.albumNotFound"
      backHref="/albums"
      backKey="site.albumsTitle"
    />
  );
}
