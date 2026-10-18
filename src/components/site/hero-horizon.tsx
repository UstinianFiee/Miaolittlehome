/**
 * 封面底部的「极光地平线」过渡（2026-10-18 替换原三层波浪）。
 *
 * ## 为什么换掉波浪
 * 原方案是 3 层横向平铺的 `mask` 波浪，靠 `mask-position` 平移制造流动。
 * 实际观感偏"卡通水波"，和整站偏克制的青绿风格不搭（用户也点名过"丑"）。
 * 现在改成**一条静态的平滑地平线曲线** + 曲线后方的**多色极光**：
 * - 曲线本身不动，只负责把深色封面干净地过渡到内容区；
 * - 极光是 3 团大半径径向光（初音绿 / 青蓝 / 樱粉），缓慢漂移、呼吸，
 *   从曲线后方透出来，像极光贴着地平线流动；
 * - 曲线边缘有一条渐变细光，另有一小段高光沿曲线缓慢滑过；
 * - 几颗微光（mote）缓慢上浮，增加空气感。
 * 只动 `transform / opacity`，不重绘滤镜；`prefers-reduced-motion` 下全部停住。
 *
 * ## 背景图的无缝衔接（沿用旧方案的结论，别删）
 * - 曲线填充层是静止的；背景图必须 `background-attachment: fixed`，
 *   与内容区背景层处于同一个视口坐标系、同一种 cover 取样，否则衔接处会有一条色差线；
 * - 底色遮罩要匹配内容区**底部**实际生效的 `--scrim-bottom`，不是 `--scrim-top`；
 * - 曲线用 `mask` 裁切填充层，不能在有 `opacity < 1` 的合成层里做（会让 mask 只栅格化一次）。
 */

const CURVE =
  "M0,88 C 210,30 420,16 650,34 C 900,54 1140,86 1440,52 L1440,120 L0,120 Z";

const CURVE_LINE =
  "M0,88 C 210,30 420,16 650,34 C 900,54 1140,86 1440,52";

export function HeroHorizon({ pageBackground }: { pageBackground: string }) {
  return (
    <div aria-hidden className="hero-horizon">
      {/* 极光：在曲线后面，从地平线往上透出，底部被曲线填充盖住 */}
      <div className="hero-horizon__aurora">
        <span className="hero-horizon__ribbon" />
        <span className="hero-horizon__glow hero-horizon__glow--brand" />
        <span className="hero-horizon__glow hero-horizon__glow--cyan" />
        <span className="hero-horizon__glow hero-horizon__glow--pink" />
        <span className="hero-horizon__mote hero-horizon__mote--1" />
        <span className="hero-horizon__mote hero-horizon__mote--2" />
        <span className="hero-horizon__mote hero-horizon__mote--3" />
        <span className="hero-horizon__mote hero-horizon__mote--4" />
        <span className="hero-horizon__mote hero-horizon__mote--5" />
      </div>

      {/* 曲线填充层：与内容区完全一致的背景（纯色 / 背景图 + 遮罩） */}
      <div className="hero-horizon__curve">
        <div className="hero-horizon__layer">
          {pageBackground ? (
            <>
              <div
                className="hero-horizon__fill"
                style={{ backgroundImage: `url("${pageBackground}")` }}
              />
              <div
                className="hero-horizon__scrim"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--background) var(--scrim-bottom), transparent)",
                }}
              />
            </>
          ) : (
            <div className="hero-horizon__scrim bg-background" />
          )}
        </div>
      </div>

      {/* 地平线描边 + 沿曲线滑过的高光 */}
      <svg
        className="hero-horizon__lines"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="hero-horizon-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.08" />
            <stop offset="22%" stopColor="var(--brand)" stopOpacity="0.7" />
            <stop offset="52%" stopColor="var(--glow-cyan)" stopOpacity="0.62" />
            <stop offset="78%" stopColor="var(--glow-pink)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path
          className="hero-horizon__rim"
          d={CURVE_LINE}
          fill="none"
          stroke="url(#hero-horizon-stroke)"
          strokeWidth="10"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={CURVE_LINE}
          fill="none"
          stroke="url(#hero-horizon-stroke)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="hero-horizon__sweep"
          d={CURVE_LINE}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
