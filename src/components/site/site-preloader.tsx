/**
 * 访问博客时的进场加载动画（2026-10-18 品牌化改版）。
 *
 * ## 为什么用「服务端出标记 + CSS 控制」而不是纯客户端
 *
 * 前台是 ISR 静态页，命中小页面几十毫秒就出来了。客户端方案有个绕不开的坑：
 * **JS 下载并执行完才会显示加载动画** —— 而慢网络下 JS 恰恰是最后到的，
 * 于是「加载动画」永远赶不上真正需要它的那段空白。
 *
 * 所以这里的做法是**默认显示、加载完再隐藏**：
 * 1. 遮罩的可见性**只由 CSS 决定**，服务端渲染的 HTML 里就带着它（不依赖 JS）；
 * 2. 一小段内联脚本在合适时机给 `<html>` 加 `is-loaded`，遮罩随之淡出；
 * 3. 另有硬上限兜底，页面里图片再多也不会一直转。
 *
 * ## 视觉
 *
 * 以站点 Logo / 个人头像为绝对主角：
 * - 中央一块带品牌渐变的「徽章」，Logo/头像在里面轻轻呼吸、上下浮动；
 * - 外圈两层反向旋转的细环 + 两颗沿轨道运行的品牌光点；
 * - 背后一团缓慢旋转的极光，给暗色开屏一点层次；
 * - 下方站名 + 一条很短的流光进度条。
 *
 * 纯 CSS，不新增客户端 JS；减少动效时全部停住。
 */
const MIN_VISIBLE_MS = 520;
const FAILSAFE_MS = 1200;
/** 同一标签页会话只播一次品牌开屏；之后整页加载直接跳过（语言切换也走整页导航）。 */
const PRELOADER_SEEN_KEY = "site-preloader-seen";

export function SitePreloader({
  image,
  siteName,
}: {
  /** 站点 Logo；没有 Logo 时由布局传入个人头像 */
  image?: string;
  siteName: string;
}) {
  const glyph = Array.from(siteName.trim())[0] ?? "·";

  return (
    <>
      {/*
        只在首次访问时播放：sessionStorage 里有标记就直接跳过（避免语言切换/重复打开
        每次都被遮 0.5s）；用 DOMContentLoaded 而不是 load 收尾，避免被背景图拖住。
        JS 被禁用或执行失败时由下面的 noscript 直接隐藏遮罩，不能让整站一直看不见。
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var d=document.documentElement,start=Date.now(),key="${PRELOADER_SEEN_KEY}";
function markSeen(){try{sessionStorage.setItem(key,"1");}catch(e){}}
function hide(){if(!d.classList.contains("is-loaded")){d.classList.add("is-loaded");}markSeen();}
try{if(sessionStorage.getItem(key)){d.classList.add("is-loaded");return;}}catch(e){}
function finish(){var wait=Math.max(0,${MIN_VISIBLE_MS}-(Date.now()-start));setTimeout(hide,wait);}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",finish,{once:true});}
else{finish();}
setTimeout(finish,${FAILSAFE_MS});})();`,
        }}
      />
      <noscript>
        <style>{`html:not(.is-loaded) .site-preloader{display:none!important}`}</style>
      </noscript>
      <div
        aria-hidden
        data-testid="site-preloader"
        className="site-preloader fixed inset-0 z-[100] flex flex-col items-center justify-center"
      >
        <div className="preloader-brand">
          <span className="preloader-aura" />
          <span className="preloader-orbit preloader-orbit--outer" />
          <span className="preloader-orbit preloader-orbit--inner" />
          <span className="preloader-orbit-dot preloader-orbit-dot--outer">
            <i />
          </span>
          <span className="preloader-orbit-dot preloader-orbit-dot--inner">
            <i />
          </span>
          <span className="preloader-glow" />

          <div className="preloader-medallion">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" width={96} height={96} />
            ) : (
              <span className="preloader-glyph">{glyph}</span>
            )}
          </div>
        </div>

        <p className="preloader-name">{siteName}</p>
        <div className="preloader-track">
          <span className="preloader-runner" />
        </div>
      </div>
    </>
  );
}
