import { prisma } from "@/lib/prisma";

/** 友链数据访问（docs/SPEC.md：友链在关于页展示，不填不显示）。 */

const friendSelect = {
  id: true,
  name: true,
  url: true,
  avatar: true,
  description: true,
  sort: true,
};

export async function listFriends() {
  return prisma.friend.findMany({
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    select: friendSelect,
  });
}

export type FriendInput = {
  name: string;
  url: string;
  avatar: string | null;
  description: string | null;
  sort: number;
};

export async function createFriend(input: FriendInput) {
  return prisma.friend.create({ data: input, select: friendSelect });
}

export async function updateFriend(id: number, input: FriendInput) {
  const existing = await prisma.friend.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.friend.update({ where: { id }, data: input, select: friendSelect });
}

export async function deleteFriend(id: number) {
  const existing = await prisma.friend.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.friend.delete({ where: { id } });
  return existing;
}
