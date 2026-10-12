import { EntityNotFound } from "@/components/site/entity-not-found";

/** 视频不存在 / 未发布：返回真正的 404 状态码。 */
export default function VideoNotFound() {
  return (
    <EntityNotFound
      messageKey="videos.notFound"
      backHref="/videos"
      backKey="videos.backToList"
    />
  );
}
