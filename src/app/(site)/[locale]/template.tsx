/**
 * 语言路由下的模板：每次路由变化都会重新挂载，借此重置页面组件的局部状态。
 *
 * ⚠️ 这里**不做**淡入动画 —— 页面切换的「旧页淡出 → 新页淡入」由挂在 layout 里的
 * `PageTransition` 统一负责。template 会随路由重挂载，拿不到上一次的 pathname，
 * 没有"淡出旧页"的时机；写在这里只会和 PageTransition 叠成两次动画（视觉发糊）。
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
