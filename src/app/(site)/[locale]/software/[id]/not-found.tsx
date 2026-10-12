import { EntityNotFound } from "@/components/site/entity-not-found";

/** 软件不存在 / 未发布：返回真正的 404 状态码。 */
export default function SoftwareNotFound() {
  return (
    <EntityNotFound
      messageKey="software.notFound"
      backHref="/software"
      backKey="software.backToList"
    />
  );
}
