import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ShuoshuoListView } from "@/components/site/shuoshuo-list-view";
import { buildPageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/shuoshuo", titleKey: "nav.shuoshuo" });
}

/** 说说列表第一页（`/shuoshuo`）。 */
export default async function ShuoshuoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ShuoshuoListView locale={locale} page={1} />;
}
