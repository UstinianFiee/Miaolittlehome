import { EntityNotFound } from "@/components/site/entity-not-found";

/** 文章不存在 / 未发布：由 page.tsx 的 notFound() 触发，返回真正的 404 状态码。 */
export default function PostNotFound() {
  return (
    <EntityNotFound messageKey="site.postNotFound" backHref="/posts" backKey="site.backToPosts" />
  );
}
