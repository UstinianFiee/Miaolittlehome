import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateProfile } from "@/lib/revalidate";
import { getProfile, profileToSettings, setSettings, type ProfileSettings } from "@/lib/settings";
import { errorResponse } from "@/lib/validation";

/** 读取关于页资料。 */
export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ ok: true, data: profile });
}

/** 保存关于页资料（显示名 / 头像 / 简介 / 自定义链接）。 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProfileSettings>;

    const entries = profileToSettings({
      name: typeof body.name === "string" ? body.name.slice(0, 50) : undefined,
      avatar: typeof body.avatar === "string" ? body.avatar.slice(0, 500) : undefined,
      bio: typeof body.bio === "string" ? body.bio.slice(0, 1000) : undefined,
      links: Array.isArray(body.links)
        ? body.links.slice(0, 30).map((link) => ({
            icon: typeof link?.icon === "string" ? link.icon.slice(0, 40) : "link",
            label: typeof link?.label === "string" ? link.label.slice(0, 40) : "",
            url: typeof link?.url === "string" ? link.url.slice(0, 500) : "",
          }))
        : undefined,
    });

    await setSettings(entries);
    await revalidateProfile();
    await logOperation({ action: "profile_update" });

    return NextResponse.json({ ok: true, data: await getProfile() });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
