/**
 * 页脚顶部的 3 层波浪分隔线。
 *
 * 每层是一个横向平铺的 SVG（两个完整周期，`preserveAspectRatio="none"` 拉伸填满），
 * 靠 `transform: translateX(-50%)` 做无缝水平流动——只动 transform，走合成器，不重绘。
 * 三层用不同的透明度（越靠前越实）、不同的流速与不同的波高，
 * 叠在一起就有层次感；矢量渲染所以曲线平滑、不会有锯齿。
 *
 * 渐变与流速都由 globals.css 的变量/关键帧控制，日夜主题各一套（见 `.footer-wave*`）。
 */

type WaveLayer = {
  /** 两层波高比例（相对容器高度） */
  height: string;
  /** 透明度：越靠前越实 */
  opacity: number;
  /** 流动一圈的时长（秒）；三层不同速度 */
  duration: number;
  /** 动画起始相位：负延迟让三层错开，避免同时对齐 */
  delay: number;
  /** 波浪路径（viewBox 0 0 2880 120，含两个完整周期，起止切线一致才能无缝平铺） */
  path: string;
};

const LAYERS: readonly WaveLayer[] = [
  {
    height: "100%",
    opacity: 0.25,
    duration: 34,
    delay: -6,
    path: "M0,64C240,8 480,8 720,64C960,120 1200,120 1440,64C1680,8 1920,8 2160,64C2400,120 2640,120 2880,64L2880,120L0,120Z",
  },
  {
    height: "72%",
    opacity: 0.45,
    duration: 26,
    delay: -13,
    path: "M0,72C200,28 400,28 600,72C800,116 1000,116 1200,72C1400,28 1600,28 1800,72C2000,116 2200,116 2400,72C2600,28 2800,28 2880,54L2880,120L0,120Z",
  },
  {
    height: "46%",
    opacity: 0.72,
    duration: 18,
    delay: -3,
    path: "M0,84C180,56 360,56 540,84C720,112 900,112 1080,84C1260,56 1440,56 1620,84C1800,112 1980,112 2160,84C2340,56 2520,56 2700,84C2790,98 2850,96 2880,90L2880,120L0,120Z",
  },
];

export function FooterWaves() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-full h-12 overflow-hidden sm:h-16"
    >
      {LAYERS.map((layer, index) => (
        <div
          key={index}
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ height: layer.height, opacity: layer.opacity }}
        >
          <div
            className="footer-wave-track h-full w-[200%]"
            style={{ animationDuration: `${layer.duration}s`, animationDelay: `${layer.delay}s` }}
          >
            <svg
              className="h-full w-full"
              viewBox="0 0 2880 120"
              preserveAspectRatio="none"
              focusable="false"
            >
              <defs>
                <linearGradient id={`footer-wave-grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--footer-wave-top)" />
                  <stop offset="100%" stopColor="var(--footer-wave-bottom)" />
                </linearGradient>
              </defs>
              <path d={layer.path} fill={`url(#footer-wave-grad-${index})`} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
