import type { Metadata } from "next";

import { FriendManager, type FriendRow } from "@/components/admin/friend-manager";
import { listFriends } from "@/lib/friends";
import { catalogs } from "@/lib/messages";

export const metadata: Metadata = {
  title: catalogs.zh.adminFriends.title,
};

export default async function AdminFriendsPage() {
  const friends = await listFriends();

  const items: FriendRow[] = friends.map((friend) => ({
    id: friend.id,
    name: friend.name,
    url: friend.url,
    avatar: friend.avatar,
    description: friend.description,
    sort: friend.sort,
  }));

  return <FriendManager items={items} />;
}
