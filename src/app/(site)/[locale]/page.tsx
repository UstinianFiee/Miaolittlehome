import { setRequestLocale } from "next-intl/server";

import { HomeView } from "@/components/site/home-view";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * 首页第一页。
 *
 * 这里**刻意不读 searchParams**：一旦读取，Next.js 就没法把首页预渲染成静态页，
 * 每次访问都要重新 SSR + 查库（响应头会变成 `no-store`）。
 * 分页改走路径段，见 ./page/[page]/page.tsx。
 */
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeView locale={locale} page={1} />;
}
