/**
 * 首页封面底部的「经典多层波浪」（2026-10-18 按参考站点改版）。
 *
 * 结构参考 haoyu233.com 使用的 4 层 gentle-wave：
 * - 同一条重复波形用 `<use>` 叠 4 次，y 依次偏移 0/3/5/7；
 * - 每层用不同 duration（7/10/13/20s）和负 delay，translate3d(-90px → 85px)
 *   做无缝水平漂移，叠出「一波推一波」的层次；
 * - 填充色就是内容区背景色（`--background`），所以没有背景图时与下方内容零接缝；
 * - 有内容区背景图时，首页在内容区顶部加 56px 全宽的「背景色 → 透明」过渡带
 *   （`has-page-bg #home-content .home-bg-bridge`），波浪底边与过渡带同色，
 *   不会出现硬接缝，也不再把封面主体裁掉；
 * - 容器高度 80/100px，`margin-bottom:-7px` 处理 Safari 的底部缝隙。
 */
export function HeroWaves() {
  return (
    <div aria-hidden className="hero-waves">
      <svg
        className="hero-waves__svg"
        viewBox="0 24 150 28"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <path
            id="hero-gentle-wave"
            d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
          />
        </defs>
        <g className="hero-waves__parallax">
          <use href="#hero-gentle-wave" x="48" y="0" />
          <use href="#hero-gentle-wave" x="48" y="3" />
          <use href="#hero-gentle-wave" x="48" y="5" />
          <use href="#hero-gentle-wave" x="48" y="7" />
        </g>
      </svg>
    </div>
  );
}
