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
 * 2. 一小段内联脚本在合适时机给 `<html>` 加 `is-loaded`，遮罩随之淡出；
 * 3. 另有硬上限兜底，页面里图片再多也不会一直转。
 *
 * ## 为什么"合适时机"不是 `load`
 *
 * `load` 要等**全部图片、字体**下完。首页有封面和背景图，实测 `load` 可能拖到十几秒，
 * 遮罩就会一直盖着已经能看的内容 —— 用户看到的是"整页闪一下白"。
 * 所以改成：`DOMContentLoaded` 后再给一小段宽限（让首屏内容落位），或者 `load` 提前到达，
 * 二者取先到者；硬上限也从 3 秒收到 1.2 秒。
 *
 * 遮罩本身设成 `pointer-events: none`（见 globals.css）：它只是视觉过渡，
 * 不应该在出现的那段时间里把点击全部吞掉。
 *
 * 它挂在站点布局里，客户端路由切换不会重新挂载，所以不会反复播；
 * 页面内的导航反馈由 `RouteProgress` 顶部进度条负责。
 */
const GRACE_MS = 400;
const FAILSAFE_MS = 1200;

export function SitePreloader({ logo, siteName }: { logo?: string; siteName: string }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var d=document.documentElement;
function done(){if(!d.classList.contains("is-loaded")){d.classList.add("is-loaded");}}
function arm(){setTimeout(done,${GRACE_MS});}
if(document.readyState==="complete"){done();}
else{
  window.addEventListener("load",done,{once:true});
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",arm,{once:true});}
  else{arm();}
  setTimeout(done,${FAILSAFE_MS});
}})();`,
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

