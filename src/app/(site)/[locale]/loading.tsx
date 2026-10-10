/**
 * 前台路由级加载态：骨架屏（带流光）。
 * SSG 页面切换通常很快，这里主要覆盖首次进入或数据较慢的情况。
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="skeleton h-8 w-40 rounded-md" />

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface p-5 sm:p-6">
              <div className="skeleton h-5 w-2/3 rounded-md" />
              <div className="skeleton mt-3 h-4 w-full rounded-md" />
              <div className="skeleton mt-2 h-4 w-4/5 rounded-md" />
              <div className="mt-4 flex gap-2">
                <div className="skeleton h-6 w-16 rounded-md" />
                <div className="skeleton h-6 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-6 lg:mt-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="surface p-5">
              <div className="skeleton h-5 w-24 rounded-md" />
              <div className="skeleton mt-4 h-4 w-full rounded-md" />
              <div className="skeleton mt-2 h-4 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
