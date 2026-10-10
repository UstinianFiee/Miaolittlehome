import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * 感知语言前缀的导航 API：用这些替代 next/link 与 next/navigation，
 * 这样 Link / usePathname 会自动带上当前语言前缀。
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
