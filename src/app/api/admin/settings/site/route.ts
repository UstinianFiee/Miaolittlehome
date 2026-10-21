import { NextResponse } from "next/server";

import { logOperation } from "@/lib/logs";
import { revalidateSiteSettings } from "@/lib/revalidate";
import { getSiteInfo, setSettings, siteToSettings, type SiteInfo } from "@/lib/settings";
import { errorResponse, requireString } from "@/lib/validation";

/** 读取站点基本信息。 */
export async function GET() {
  return NextResponse.json({ ok: true, data: await getSiteInfo() });
}

/** 保存站点基本信息（名称 / 作者 / 描述）。 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<SiteInfo>;

    const entries = siteToSettings({
      name: requireString(body.name, "站点名称", { max: 50 }),
      author: requireString(body.author, "作者", { max: 50 }),
      description: typeof body.description === "string" ? body.description.slice(0, 300) : undefined,
      subtitle: typeof body.subtitle === "string" ? body.subtitle.slice(0, 120) : undefined,
      subtitleEn:
        typeof body.subtitleEn === "string" ? body.subtitleEn.slice(0, 120) : undefined,
      // logo / background 存的是站内媒体路径或外链，长度设上限即可
      logo: typeof body.logo === "string" ? body.logo.slice(0, 500) : undefined,
      background: typeof body.background === "string" ? body.background.slice(0, 500) : undefined,
      backgrounds: Array.isArray(body.backgrounds)
        ? body.backgrounds
            .slice(0, 10)
            .map((item) => (typeof item === "string" ? item.slice(0, 500) : ""))
        : undefined,
      backgroundVideo:
        typeof body.backgroundVideo === "string" ? body.backgroundVideo.slice(0, 500) : undefined,
      pageBackground:
        typeof body.pageBackground === "string" ? body.pageBackground.slice(0, 500) : undefined,
      postBackground:
        typeof body.postBackground === "string" ? body.postBackground.slice(0, 500) : undefined,
      favicon: typeof body.favicon === "string" ? body.favicon.slice(0, 500) : undefined,
      icp: typeof body.icp === "string" ? body.icp.slice(0, 100) : undefined,
      icpLink: typeof body.icpLink === "string" ? body.icpLink.slice(0, 500) : undefined,
      police: typeof body.police === "string" ? body.police.slice(0, 100) : undefined,
      policeLink: typeof body.policeLink === "string" ? body.policeLink.slice(0, 500) : undefined,
    });

    await setSettings(entries);
    await revalidateSiteSettings();
    await logOperation({ action: "site_settings_update", target: entries["site.name"] });

    return NextResponse.json({ ok: true, data: await getSiteInfo() });
  } catch (error) {
    const { message, status } = errorResponse(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
