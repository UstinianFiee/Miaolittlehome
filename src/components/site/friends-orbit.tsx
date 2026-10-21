import type { CSSProperties } from "react";

import type { Friend } from "@prisma/client";

import { Link } from "@/i18n/navigation";
import { resizedImageUrl } from "@/lib/image-url";

const CENTER = { x: 400, y: 320 };
/**
 * 轨道半径用**舞台宽度的比例**表示，而不是固定 px。
 * SVG 会随容器缩放（viewBox + preserveAspectRatio），如果头像用固定 px 定位，
 * 容器一窄头像就会跑出轨道环（实测 736px 宽时偏差约 8%）。
 * 比例值 = 原 px / 800（viewBox 宽度）。
 */
const RADIUS_FRACTIONS = [0.185, 0.28, 0.365] as const;

/**
 * 环数按友链数量决定，且**环少时直接用外圈**：
 * 只有两三个友链却硬分成三环，会变成一条歪歪扭扭的竖线、中心还挤成一团。
 * 数量少时用大半径单环，画面舒展得多。
 */
function pickRadii(count: number): readonly number[] {
  if (count <= 3) return [RADIUS_FRACTIONS[2]];
  if (count <= 6) return [RADIUS_FRACTIONS[1], RADIUS_FRACTIONS[2]];
  return RADIUS_FRACTIONS;
}

type OrbitFriend = {
  friend: Friend;
  angle: number;
  radiusFraction: number;
  x: number;
  y: number;
  ring: number;
  /** 信息卡朝上还是朝下弹，避免上半圈的卡片盖住中心 */
  side: "top" | "bottom";
};

function arrangeFriends(friends: Friend[]): OrbitFriend[] {
  if (friends.length === 0) return [];

  const radii = pickRadii(friends.length);
  const ringCount = radii.length;
  // `sort` (ascending) is the existing friend ordering; earlier links are
  // placed on inner rings, later links on the outer rings.
  const perRing = Math.ceil(friends.length / ringCount);

  return friends.map((friend, index) => {
    const ring = Math.min(ringCount - 1, Math.floor(index / perRing));
    const ringStart = ring * perRing;
    const inRingIndex = index - ringStart;
    const inRingCount = Math.min(perRing, friends.length - ringStart);
    const angle = -90 + (360 * inRingIndex) / inRingCount + (ring % 2 ? 180 / inRingCount : 0);
    const radiusFraction = radii[ring];
    const radius = radiusFraction * 800;
    const radians = (angle * Math.PI) / 180;

    return {
      friend,
      angle,
      radiusFraction,
      ring,
      side: Math.sin(radians) < 0 ? "top" : "bottom",
      x: CENTER.x + Math.cos(radians) * radius,
      y: CENTER.y + Math.sin(radians) * radius,
    };
  });
}

function FriendAvatar({ friend }: { friend: Friend }) {
  if (friend.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resizedImageUrl(friend.avatar, 128)} alt="" loading="lazy" decoding="async" className="size-full rounded-full object-cover" />;
  }
  return <span aria-hidden className="flex size-full items-center justify-center rounded-full bg-primary/12 font-display text-xl text-primary">{Array.from(friend.name)[0] ?? "?"}</span>;
}

export function FriendsOrbit({
  friends,
  siteName,
  logo,
  emptyLabel,
  visitLabel,
}: {
  friends: Friend[];
  siteName: string;
  logo: string;
  emptyLabel: string;
  visitLabel: (name: string) => string;
}) {
  const orbit = arrangeFriends(friends);
  // 只画实际用到的轨道环 —— 画了环却没有星球会显得空
  const rings = [...new Set(orbit.map((item) => item.radiusFraction))];

  if (orbit.length === 0) {
    return <p className="empty-state surface p-10 text-center text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      <section className="friends-orbit-stage mx-auto" aria-label={siteName}>
        <div className="friends-orbit" aria-label={`${siteName} 的友链星系`}>
          <div className="friends-orbit__spin">
            <svg
              aria-hidden="true"
              className="friends-orbit__map"
              viewBox="0 0 800 640"
              preserveAspectRatio="xMidYMid meet"
            >
              {rings.map((fraction, index) => (
                <circle
                  key={`ring-${fraction}`}
                  cx={CENTER.x}
                  cy={CENTER.y}
                  r={fraction * 800}
                  className={`friends-orbit__ring friends-orbit__ring--${index + 1}`}
                />
              ))}
              {orbit.map((item) => (
                <path
                  key={`link-${item.friend.id}`}
                  d={`M ${CENTER.x} ${CENTER.y} Q ${(CENTER.x + item.x) / 2 + (item.ring - 1) * 18} ${(CENTER.y + item.y) / 2 - (item.ring - 1) * 14} ${item.x} ${item.y}`}
                  className="friends-orbit__connection"
                />
              ))}
            </svg>

            {orbit.map((item) => (
              <div
                key={item.friend.id}
                className="friends-orbit__position"
                style={{
                  "--orbit-angle": `${item.angle}deg`,
                  "--orbit-counter-angle": `${-item.angle}deg`,
                  "--orbit-radius": `${item.radiusFraction}`,
                } as CSSProperties}
              >
                <div className="friends-orbit__counter">
                  <a
                    href={item.friend.url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    aria-label={visitLabel(item.friend.name)}
                    className="friends-orbit__link"
                    data-side={item.side}
                  >
                    <span className="friends-orbit__avatar">
                      <FriendAvatar friend={item.friend} />
                    </span>
                    <span className="friends-orbit__tooltip">
                      <strong className="block font-display text-base text-[color:var(--card-foreground)]">{item.friend.name}</strong>
                      {item.friend.description ? (
                        <span className="mt-1 block text-[0.8rem] leading-[1.6] text-muted-foreground">{item.friend.description}</span>
                      ) : null}
                      <span className="mt-2 block truncate text-[0.8rem] text-primary">
                        {item.friend.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </span>
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          <Link href="/" aria-label={siteName} className="friends-orbit__center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resizedImageUrl(logo, 128)} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="friends-orbit__center-mark">{Array.from(siteName)[0] ?? "M"}</span>
            )}
            <span className="mt-2 max-w-28 truncate text-center font-display text-sm">{siteName}</span>
          </Link>
        </div>
      </section>

      <ul className="friends-mobile-list" aria-label={siteName}>
        {friends.map((friend) => (
          <li key={friend.id}>
            <a href={friend.url} target="_blank" rel="nofollow noopener noreferrer" className="surface friends-mobile-card">
              <span className="friends-mobile-card__avatar"><FriendAvatar friend={friend} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block font-display text-base text-[color:var(--card-foreground)]">{friend.name}</strong>
                {friend.description ? <span className="mt-1 block text-sm leading-6 text-muted-foreground">{friend.description}</span> : null}
                <span className="mt-2 block truncate text-[0.8rem] text-primary">{friend.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
              </span>
              <span aria-hidden="true" className="friends-mobile-card__spark" />
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
