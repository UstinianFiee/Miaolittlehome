import { ArrowUpRightIcon, BookOpenIcon, CameraIcon, Code2Icon, HeartIcon, MapPinIcon, MessageCircleIcon, Music2Icon, QuoteIcon, SparklesIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DualTime } from "@/components/site/dual-time";
import { ProfileIcon, iconLabel } from "@/components/site/profile-icon";
import { Link } from "@/i18n/navigation";
import { resizedImageUrl } from "@/lib/image-url";
import { buildPageMetadata } from "@/lib/metadata";
import { pickLocalized } from "@/lib/localized";
import { getPlaylist } from "@/lib/playlist";
import { getAboutOverview } from "@/lib/query";
import { getProfile, getSiteInfo, type ProfileLink } from "@/lib/settings";

type Props = { params: Promise<{ locale: string }> };
function safeHref(raw: string) {
  try { const url = new URL(raw); return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function linkHref(link: ProfileLink) {
  const raw = link.url.trim();
  return safeHref(link.icon === "email" && !/^[a-z][a-z0-9+.-]*:/i.test(raw) ? `mailto:${raw}` : raw);
}
const tags = (text: string) => text.split(/[\n,，]/).map(s => s.trim()).filter(Boolean).slice(0, 24);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({ locale, path: "/about", titleKey: "nav.about" });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const [profile, info, overview, playlist] = await Promise.all([getProfile(), getSiteInfo(), getAboutOverview(), getPlaylist()]);
  const name = profile.name || info.author || info.name;
  const details = profile.about;
  const skills = tags(details.skills);
  const interests = tags(details.interests);
  const technologies = skills.length ? skills : ["Next.js", "React", "TypeScript", "Tailwind CSS", "Prisma", "SQLite", "Docker", "Nginx"];
  const projects = details.projects.split("\n").map(line => {
    const [title, url, ...description] = line.split("|").map(s => s.trim());
    return { title, href: safeHref(url || ""), description: description.join(" · ") };
  }).filter(p => p.title && p.href).slice(0, 8);
  const socials = profile.links.flatMap(link => { const href = linkHref(link); return href ? [{ ...link, href }] : []; });
  const avatar = profile.avatar || info.logo;
  const stats = [
    { count: overview.posts, label: t("posts"), href: "/posts" },
    { count: overview.notes, label: t("notes"), href: "/shuoshuo" },
    { count: overview.albums, label: t("albums"), href: "/albums" },
    { count: overview.friends, label: t("friends"), href: "/friends" },
  ];

  return (
    <div className="about-page mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <header className="about-hero surface relative overflow-hidden p-6 sm:p-10">
        <div aria-hidden className="about-hero__orbit" />
        <div className="relative z-10 flex flex-col gap-7 sm:flex-row sm:items-center">
          <div className="about-portrait shrink-0 self-start sm:self-center">
            {avatar ? <img src={resizedImageUrl(avatar, 256)} alt={name} width={128} height={128} className="size-24 rounded-full object-cover sm:size-32" /> : <UserIcon className="size-24 p-6 text-primary sm:size-32" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="about-eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 font-display text-3xl leading-tight break-words sm:text-5xl">{t("hello", { name })}</h1>
            <p className="mt-4 max-w-2xl leading-8 text-foreground whitespace-pre-wrap">{profile.bio || info.description || t("intro")}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {details.role && <span className="about-chip"><UserIcon className="size-3.5" />{details.role}</span>}
              {details.location && <span className="about-chip"><MapPinIcon className="size-3.5" />{details.location}</span>}
              <Link href="/wall" className="about-chip about-chip--link">{t("sayHello")}<ArrowUpRightIcon className="size-3.5" /></Link>
            </div>
          </div>
        </div>
      </header>

      <div className="about-grid mt-5">
        <section className="about-panel surface about-span-8" data-testid="about-stats">
          <p className="about-eyebrow">{t("footprints")}</p>
          <h2 className="mt-2 font-display text-2xl">{t("littleWorld")}</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map(stat => <Link key={stat.href} href={stat.href} className="about-stat"><strong>{stat.count.toLocaleString(locale)}</strong><span>{stat.label}<ArrowUpRightIcon className="size-3" /></span></Link>)}
          </div>
        </section>
        <section className="about-panel about-quote surface about-span-4">
          <QuoteIcon aria-hidden className="size-7 text-primary/60" />
          <p className="mt-4 font-display text-xl leading-relaxed whitespace-pre-wrap">{details.motto || t("motto")}</p>
          <p className="mt-5 text-[0.8rem] leading-[1.6] text-muted-foreground">{info.name}</p>
        </section>

        <section className="about-panel surface about-span-8">
          <h2 className="section-title"><Code2Icon className="size-4" />{skills.length ? t("skills") : t("builtWith")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{skills.length ? t("skillsHint") : t("builtHint")}</p>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {technologies.map((skill, i) => <li key={`${skill}-${i}`} className="about-tech"><span aria-hidden className="about-tech__index">{String(i + 1).padStart(2, "0")}</span><span>{skill}</span></li>)}
          </ul>
        </section>
        <section className="about-panel surface about-span-4" data-testid="social-section">
          <h2 className="section-title"><MessageCircleIcon className="size-4" />{t("contact")}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("contactHint")}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {socials.map((link, i) => <li key={i}><a href={link.href} target="_blank" rel="nofollow noopener noreferrer" className="about-chip about-chip--link"><ProfileIcon name={link.icon} className="size-4 shrink-0" />{link.label || iconLabel(link.icon)}</a></li>)}
          </ul>
          <Link href="/wall" className="about-text-link mt-5">{t("leaveMessage")}<ArrowUpRightIcon className="size-4" /></Link>
        </section>

        <section className="about-panel surface about-span-7">
          <h2 className="section-title"><BookOpenIcon className="size-4" />{projects.length ? t("projects") : t("recentWriting")}</h2>
          <div className="mt-4 divide-y divide-border/60">
            {projects.length ? projects.map((project, i) => <a key={i} href={project.href!} target="_blank" rel="noopener noreferrer" className="about-entry"><span className="min-w-0"><strong>{project.title}</strong>{project.description && <span className="mt-1 block text-sm leading-6 text-muted-foreground">{project.description}</span>}</span><ArrowUpRightIcon className="size-4 shrink-0 text-primary" /></a>) : overview.recent.map(post => <div key={post.slug} className="py-4"><Link href={`/posts/${post.slug}`} className="about-text-link justify-between"><span>{pickLocalized(locale, post.title, post.titleEn)}</span><ArrowUpRightIcon className="size-4 shrink-0" /></Link><DualTime date={post.createdAt} className="mt-2 text-[0.8rem] leading-[1.6] text-muted-foreground" /></div>)}
            {!projects.length && !overview.recent.length && <p className="py-6 text-sm text-muted-foreground">{t("writingEmpty")}</p>}
          </div>
          <Link href="/posts" className="about-text-link mt-3 text-sm">{t("allWriting")}<ArrowUpRightIcon className="size-4" /></Link>
        </section>
        <section className="about-panel surface about-span-5">
          <h2 className="section-title"><HeartIcon className="size-4" />{interests.length ? t("interests") : t("explore")}</h2>
          {interests.length ? <ul className="mt-5 flex flex-wrap gap-2">{interests.map((interest,i) => <li key={i} className="about-chip">{interest}</li>)}</ul> : <div className="mt-5 space-y-3">{[{href:"/albums",title:t("photoTitle"),text:t("photoHint"),icon:CameraIcon},{href:"/shuoshuo",title:t("noteTitle"),text:t("noteHint"),icon:MessageCircleIcon},{href:"/friends",title:t("friendTitle"),text:t("friendHint"),icon:SparklesIcon}].map(item => <Link key={item.href} href={item.href} className="about-explore"><item.icon className="size-5 text-primary" /><span><strong className="text-sm">{item.title}</strong><span className="block text-[0.8rem] leading-[1.6] text-muted-foreground">{item.text}</span></span><ArrowUpRightIcon className="ml-auto size-4 shrink-0" /></Link>)}</div>}
        </section>

        {overview.photos.length > 0 && <section className={`about-panel surface ${playlist.length ? "about-span-7" : "about-span-12"}`}>
          <h2 className="section-title"><CameraIcon className="size-4" />{t("moments")}</h2>
          <div className="about-photo-strip mt-5">{overview.photos.map((photo,i) => <Link key={photo.id} href={`/albums/${photo.albumId}`} className="about-photo" aria-label={t("openAlbum")}><img src={resizedImageUrl(photo.thumb || photo.path, 640)} alt={photo.title || t("photoAlt",{index:i+1})} loading="lazy" decoding="async" /><span aria-hidden>{String(i+1).padStart(2,"0")}</span></Link>)}</div>
        </section>}
        {playlist.length > 0 && <section className={`about-panel surface ${overview.photos.length ? "about-span-5" : "about-span-12"}`}>
          <h2 className="section-title"><Music2Icon className="size-4" />{t("playlist")}</h2>
          <p className="mt-2 text-[0.8rem] leading-[1.6] text-muted-foreground">{t("playlistHint")}</p>
          <ol className="mt-4 space-y-4">{playlist.slice(0,3).map((track,i) => <li key={track.id} className="flex min-w-0 items-center gap-3"><span className="text-[0.8rem] leading-[1.6] tabular-nums text-primary">{String(i+1).padStart(2,"0")}</span>{track.cover && <img src={resizedImageUrl(track.cover, 128)} alt="" loading="lazy" className="size-10 rounded-full object-cover" />}<span className="min-w-0"><strong className="block truncate text-sm font-medium">{track.title}</strong><span className="block truncate text-[0.8rem] leading-[1.6] text-muted-foreground">{track.artist}</span></span></li>)}</ol>
        </section>}

        {details.story && <section className="about-panel surface about-span-8"><h2 className="section-title">{t("story")}</h2><div className="mt-5 space-y-4 leading-8 text-foreground">{details.story.split(/\n\s*\n/).filter(Boolean).map((paragraph,i) => <p key={i} className="whitespace-pre-wrap break-words">{paragraph}</p>)}</div></section>}
        {overview.latestNote && <section className={`about-panel surface ${details.story ? "about-span-4" : "about-span-12"}`}><h2 className="section-title"><MessageCircleIcon className="size-4" />{t("latestNote")}</h2><p className="mt-4 line-clamp-4 leading-8 text-foreground whitespace-pre-wrap">{pickLocalized(locale,overview.latestNote.content,overview.latestNote.contentEn)}</p><DualTime date={overview.latestNote.createdAt} className="mt-3 text-[0.8rem] leading-[1.6] text-muted-foreground" /><div><Link href="/shuoshuo" className="about-text-link mt-4 text-sm">{t("readNotes")}<ArrowUpRightIcon className="size-4" /></Link></div></section>}
      </div>
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground"><p>{t("thanks")}</p><Link href="/friends" className="about-text-link">{t("visitFriends")}<ArrowUpRightIcon className="size-4" /></Link></footer>
    </div>
  );
}
