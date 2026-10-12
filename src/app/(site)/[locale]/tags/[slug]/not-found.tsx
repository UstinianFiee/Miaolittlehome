import { EntityNotFound } from "@/components/site/entity-not-found";

/** 标签不存在：返回真正的 404 状态码。 */
export default function TagNotFound() {
  return (
    <EntityNotFound messageKey="site.tagNotFound" backHref="/tags" backKey="site.tagsTitle" />
  );
}
