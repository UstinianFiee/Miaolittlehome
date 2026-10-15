import type { Metadata } from "next";

import { FriendManager, type FriendRow } from "@/components/admin/friend-manager";
import type { MediaOption } from "@/components/admin/media-field";
import { listFriends } from "@/lib/friends";
import { catalogs } from "@/lib/messages";
import { listMedia } from "@/lib/media";

export const metadata: Metadata = {
  title: catalogs.zh.adminFriends.title,
};

export default async function AdminFriendsPage() {
  const [friends, images] = await Promise.all([listFriends(), listMedia({ type: "image", limit: 200 })]);

  const items: FriendRow[] = friends.map((friend) => ({
    id: friend.id,
    name: friend.name,
    url: friend.url,
    avatar: friend.avatar,
    description: friend.description,
    sort: friend.sort,
  }));

  const imageOptions: MediaOption[] = images.map((image) => ({
    id: image.id,
    path: image.path,
    title: image.title ?? image.path,
  }));

  return <FriendManager items={items} images={imageOptions} />;
}
