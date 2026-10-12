import { EntityNotFound } from "@/components/site/entity-not-found";

/** 分类不存在：返回真正的 404 状态码。 */
export default function CategoryNotFound() {
  return (
    <EntityNotFound
      messageKey="site.categoryNotFound"
      backHref="/categories"
      backKey="site.categoriesTitle"
    />
  );
}
