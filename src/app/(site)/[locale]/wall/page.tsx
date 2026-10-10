import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CommentSection } from "@/components/site/comment-section";
import { countCommentViews, toCommentViews } from "@/lib/comment-view";
import { listApprovedComments } from "@/lib/comments";
import { buildPageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/wall", titleKey: "nav.wall" });
}

export default async function WallPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const comments = await listApprovedComments({ type: "wall", refId: null });
  const views = toCommentViews(comments);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl">{t("site.wallTitle")}</h1>
        <p className="text-muted-foreground">{t("site.wallDescription")}</p>
      </header>

      <CommentSection
        scope="wall"
        refId={null}
        initialComments={views}
        count={countCommentViews(views)}
      />
    </div>
  );
}
