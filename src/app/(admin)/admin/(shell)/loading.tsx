/**
 * 后台页面切换时的骨架屏。
 *
 * 侧边栏预取已关闭（后台页面都是动态查询，预取会连带着把媒体库 500 条、
 * 设置页媒体选项全查一遍），所以切页时先给一块和内容同宽度的骨架，
 * 比停在旧页面、看起来「点不动」要清楚得多。
 */
export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-36 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 w-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="surface flex h-64 animate-pulse flex-col overflow-hidden"
          >
            <div className="h-32 bg-muted/70" />
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="mt-auto h-8 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
