/**
 * 封面底部「流光丝带」过渡（A/B 预览版）。
 *
 * 和 `HeroHorizon`（静态曲线 + 极光光带）的区别：
 * - 内容区的曲线填充完全复用，背景图 `fixed` 采样、`--scrim-bottom` 遮罩等约束不变；
 * - 曲线背后换成 2 条**渐变丝带** + 1 条沿丝带流动的亮线，颜色是初音绿 → 青 → 淡紫 → 樱粉；
 * - 丝带缓慢漂移、呼吸，但不改变形状；内容边缘始终由同一条静态曲线裁切，不会抖。
 *
 * 只动 `transform / opacity / stroke-dashoffset`，减少动效时全部停住。
 */

const CURVE =
  "M0,88 C 210,30 420,16 650,34 C 900,54 1140,86 1440,52 L1440,120 L0,120 Z";

const CURVE_LINE =
  "M0,88 C 210,30 420,16 650,34 C 900,54 1140,86 1440,52";

const SILK_A_BAND =
  "M-160,20 C 160,-10 380,46 680,10 C 980,-14 1240,34 1600,18 L1600,42 C 1240,58 980,8 680,34 C 380,72 160,22 -160,44 Z";

const SILK_A_EDGE =
  "M-160,20 C 160,-10 380,46 680,10 C 980,-14 1240,34 1600,18";

const SILK_B_BAND =
  "M-160,46 C 180,64 380,2 700,26 C 980,50 1220,0 1600,40 L1600,56 C 1220,16 980,68 700,42 C 380,18 180,80 -160,62 Z";

const SILK_B_EDGE =
  "M-160,46 C 180,64 380,2 700,26 C 980,50 1220,0 1600,40";

const SILK_FLOW =
  "M-160,20 C 160,-10 380,46 680,10 C 980,-14 1240,34 1600,18";

export function HeroHorizonSilk({ pageBackground }: { pageBackground: string }) {
  return (
    <div aria-hidden className="hero-horizon">
      {/* 极光底色：两团柔光，给丝带垫一层空气感 */}
      <div className="hero-horizon__aurora">
        <span className="hero-horizon__glow hero-horizon__glow--brand" />
        <span className="hero-horizon__glow hero-horizon__glow--cyan" />
        <span className="hero-horizon__mote hero-horizon__mote--1" />
        <span className="hero-horizon__mote hero-horizon__mote--2" />
        <span className="hero-horizon__mote hero-horizon__mote--3" />
        <span className="hero-horizon__mote hero-horizon__mote--4" />
        <span className="hero-horizon__mote hero-horizon__mote--5" />
      </div>

      {/* 丝带：在内容曲线后面，底部被曲线盖住，只从地平线上方透出 */}
      <svg
        className="hero-horizon__silks"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="silk-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="15%" stopColor="var(--brand)" stopOpacity="0.95" />
            <stop offset="46%" stopColor="var(--glow-cyan)" stopOpacity="0.82" />
            <stop offset="72%" stopColor="var(--glow-lilac)" stopOpacity="0.52" />
            <stop offset="90%" stopColor="var(--glow-pink)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--glow-pink)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="silk-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--glow-pink)" stopOpacity="0" />
            <stop offset="24%" stopColor="var(--glow-lilac)" stopOpacity="0.7" />
            <stop offset="55%" stopColor="var(--glow-pink)" stopOpacity="0.55" />
            <stop offset="82%" stopColor="var(--brand)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="silk-edge-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="30%" stopColor="#d8fff9" stopOpacity="0.9" />
            <stop offset="62%" stopColor="var(--glow-cyan)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--glow-cyan)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="silk-edge-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--glow-pink)" stopOpacity="0" />
            <stop offset="38%" stopColor="#ffd6e8" stopOpacity="0.8" />
            <stop offset="72%" stopColor="var(--glow-lilac)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--glow-lilac)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="silk-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="35%" stopColor="var(--glow-cyan)" stopOpacity="0.9" />
            <stop offset="62%" stopColor="#dffdf9" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--glow-pink)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path className="hero-horizon__silk-glow" d={SILK_A_BAND} fill="url(#silk-a)" />
        <g className="hero-horizon__silk-group hero-horizon__silk-group--a">
          <path className="hero-horizon__silk hero-horizon__silk--a" d={SILK_A_BAND} fill="url(#silk-a)" />
          <path className="hero-horizon__silk-edge" d={SILK_A_EDGE} stroke="url(#silk-edge-a)" />
        </g>
        <g className="hero-horizon__silk-group hero-horizon__silk-group--b">
          <path className="hero-horizon__silk hero-horizon__silk--b" d={SILK_B_BAND} fill="url(#silk-b)" />
          <path className="hero-horizon__silk-edge" d={SILK_B_EDGE} stroke="url(#silk-edge-b)" />
        </g>
        <path className="hero-horizon__silk-flow" d={SILK_FLOW} stroke="url(#silk-flow)" />
      </svg>

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

      {/* 地平线描边 + 沿曲线滑过的高光（保持内容边缘清晰） */}
      <svg
        className="hero-horizon__lines"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="hero-horizon-stroke-silk" x1="0" y1="0" x2="1" y2="0">
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
          stroke="url(#hero-horizon-stroke-silk)"
          strokeWidth="10"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={CURVE_LINE}
          fill="none"
          stroke="url(#hero-horizon-stroke-silk)"
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
