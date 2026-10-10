/**
 * 语言路由下的模板：每次路由变化都会重新挂载，
 * 借此给页面内容做一次轻量的淡入上移过渡（见 globals.css 的 .page-enter）。
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
