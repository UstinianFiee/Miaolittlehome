import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/category-manager";
import { catalogs } from "@/lib/messages";
import { listCategories } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: catalogs.zh.categories.title,
};

export default async function AdminCategoriesPage() {
  const categories = await listCategories();

  return (
    <CategoryManager
      items={categories.map((category) => ({
        id: category.id,
        name: category.name,
        nameEn: category.nameEn,
        type: category.type,
        sort: category.sort,
        postCount: category._count.posts,
      }))}
    />
  );
}
