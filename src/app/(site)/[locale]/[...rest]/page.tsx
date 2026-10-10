import { notFound } from "next/navigation";

/**
 * 兜底路由：捕获语言路由下所有未匹配的路径，交给同级的 not-found.tsx 渲染。
 * 没有它时，Next 会用内置的默认 404 页面，自定义样式不会生效。
 */
export default function CatchAllNotFound() {
  notFound();
}
