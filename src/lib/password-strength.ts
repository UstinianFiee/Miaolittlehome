/**
 * 密码强度评分（0–100）。
 *
 * 只用来驱动登录页那根「温度计」的视觉反馈，**不参与任何安全判定**——
 * 后台只有单管理员，密码强度由部署者自己负责（见 docs/部署手册.md）。
 */

export type PasswordStrength = {
  /** 0–100 */
  score: number;
  /** 0 空 / 1 弱 / 2 中 / 3 强 / 4 很强 */
  level: 0 | 1 | 2 | 3 | 4;
  /** 文案 key，对应 messages 里的 login.strength* */
  labelKey: "strengthEmpty" | "strengthWeak" | "strengthFair" | "strengthGood" | "strengthStrong";
};

const LEVEL_KEYS = [
  "strengthEmpty",
  "strengthWeak",
  "strengthFair",
  "strengthGood",
  "strengthStrong",
] as const;

export function passwordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, level: 0, labelKey: "strengthEmpty" };
  }

  // 长度：前 16 位线性加分（够长基本就够安全了，再长边际收益低）
  const lengthScore = Math.min(password.length, 16) * 3.2;

  // 字符种类：小写 / 大写 / 数字 / 符号，每多一类加 13 分
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  const varietyScore = variety * 13;

  // 纯数字或纯字母的密码再压一档
  const penalty = /^\d+$/.test(password) || /^[a-zA-Z]+$/.test(password) ? 14 : 0;

  const score = Math.max(0, Math.min(100, Math.round(lengthScore + varietyScore - penalty)));

  const level: PasswordStrength["level"] =
    score >= 85 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1;

  return { score, level, labelKey: LEVEL_KEYS[level] };
}

/** 每一档对应的颜色（与 globals.css 里温度计渐变的色标一致）。 */
export const STRENGTH_COLORS = ["transparent", "#ef4444", "#fbbf24", "#a3e635", "#22c55e"] as const;
