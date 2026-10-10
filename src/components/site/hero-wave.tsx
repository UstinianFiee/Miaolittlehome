/**
 * 封面底部的波浪过渡（3 层，与页脚同一种视觉语言）。
 *
 * 每层都是一个横向平铺的遮罩（形状与位移动画定义在 globals.css 的
 * `.hero-wave*`），越靠前的层波高越浅、越不透明、流得越快，叠出层次。
 *
 * `pageBackground` 是内容区背景图（可能为空）：
 * 传空时波浪填纯色页面底色；传了图就复刻内容区那层「固定背景图 + 半透明遮罩」，
 * 保证波浪与内容区无缝衔接。
 */

type WaveLayer = {
  /** 层级类名（决定用哪条遮罩路径） */
  className: string;
  /** 层高占容器比例：越靠前越矮 */
  height: string;
  opacity: number;
  duration: number;
  delay: number;
};

const LAYERS: readonly WaveLayer[] = [
  { className: "hero-wave-1", height: "100%", opacity: 0.45, duration: 34, delay: -6 },
  { className: "hero-wave-2", height: "74%", opacity: 0.68, duration: 25, delay: -13 },
  { className: "hero-wave-3", height: "48%", opacity: 0.92, duration: 17, delay: -3 },
];

export function HeroWave({ pageBackground }: { pageBackground: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-20 overflow-hidden sm:h-32"
    >
      {LAYERS.map((layer) => (
        <div
          key={layer.className}
          className={`hero-wave ${layer.className} absolute inset-x-0 bottom-0`}
          style={{
            height: layer.height,
            opacity: layer.opacity,
            animationDuration: `${layer.duration}s`,
            animationDelay: `${layer.delay}s`,
          }}
        >
          {pageBackground ? (
            <>
              {/* 与布局里的内容区背景层用同样的 fixed / cover / center，位置才对得上 */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url("${pageBackground}")`,
                  backgroundAttachment: "fixed",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              {/* 与布局里的遮罩保持同一种透明度 */}
              <div className="absolute inset-0 bg-background/75" />
            </>
          ) : (
            <div className="absolute inset-0 bg-background" />
          )}

          {/* 波峰提亮：底部渐隐到透明，所以不会和内容区产生接缝 */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--hero-wave-tint),transparent_70%)]" />
        </div>
      ))}
    </div>
  );
}
