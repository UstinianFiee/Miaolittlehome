/**
 * 访问博客时的进场加载动画。
 *
 * ## 为什么用「服务端出标记 + CSS 控制」而不是纯客户端
 *
 * 前台是 ISR 静态页，命中小页面几十毫秒就出来了。客户端方案有个绕不开的坑：
 * **JS 下载并执行完才会显示加载动画** —— 而慢网络下 JS 恰恰是最后到的，
 * 于是"加载动画"永远赶不上真正需要它的那段空白。
 *
 * 所以这里的做法是**默认显示、加载完再隐藏**：
 * 1. 遮罩的可见性**只由 CSS 决定**，服务端渲染的 HTML 里就带着它（不依赖 JS）；
 * 2. 一小段内联脚本在 `load` 之后给 `<html>` 加 `is-loaded`，遮罩随之淡出；
 * 3. 另外给 3 秒硬上限 —— 页面里图片再多也不会一直转。
 *
 * 这样加载快时 `load` 几乎立刻触发，遮罩一闪而过；加载慢时它实打实地盖着那段空白。
 * 没有 JS 也能正常显示（只是不会自动消失，而看不了 JS 的访客本来也没有内容可看）。
 *
 * 它挂在站点布局里，客户端路由切换不会重新挂载，所以不会反复播；
 * 页面内的导航反馈由 `RouteProgress` 顶部进度条负责。
 */
export function SitePreloader({ logo, siteName }: { logo?: string; siteName: string }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var d=document.documentElement;
function done(){d.classList.add("is-loaded");}
if(document.readyState==="complete"){done();}
else{window.addEventListener("load",done,{once:true});setTimeout(done,3000);}})();`,
        }}
      />
      <div
        aria-hidden
        data-testid="site-preloader"
        className="site-preloader fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--background)" }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            width={72}
            height={72}
            className="preloader-pulse size-18 rounded-xl border border-border/60 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="preloader-pulse block size-14 rounded-full bg-primary ring-4 ring-primary/20"
          />
        )}

        <p className="font-display text-sm text-muted-foreground">{siteName}</p>

        {/* 细长的扫过条：比转圈更克制，也和站内其它加载反馈一致 */}
        <div className="h-0.5 w-28 overflow-hidden rounded-full bg-muted">
          <div className="preloader-bar h-full w-full rounded-full bg-primary" />
        </div>
      </div>
    </>
  );
}

