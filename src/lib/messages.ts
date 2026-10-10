import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

/**
 * 语言包集合。
 * 静态引入（而非动态 import）以便打包器确定依赖并获得类型检查。
 * 前台由 src/i18n/request.ts 按当前语言取用；后台固定使用 zh。
 */
export const catalogs = { zh, en } as const;

export type Messages = typeof zh;
