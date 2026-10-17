/**
 * 封面底部的波浪过渡（3 层，与页脚同一种视觉语言）。
 *
 * 每层结构是 **窗口 > 填充层 > 三层内容**：
 * - **窗口**（`.hero-wave-window`）：`overflow: hidden` 裁内容，**mask 与
 *   `mask-position` 动画都在这一层**（遮罩平移、填充不动，所以背景永不错位）。
 *   ⚠️ 窗口上**绝不能有 `opacity`** —— <1 会建合成层，合成层里的 mask
 *   只光栅化一次就不再更新，真机上「波浪完全定格」就是这么来的。
 * - **填充层**（`.hero-wave-layer`）：静止，只承担本层透明度。
 * - 内容三层：背景图（**`fixed`**）→ 底色遮罩 → 波峰提亮。
 *
 * 背景图必须 `background-attachment: fixed`：内容区背景层是 fixed + 整个视口
 * cover，而这里是 128px 高的窗口 —— 容器高度不同会让同一张图的取样完全不同，
 * 衔接处出现一条持续的割裂线（实测亮度差 41）。
 *
 * `pageBackground` 是内容区背景图（可能为空）：
 * 传空时波浪填纯色页面底色；传了图就复刻内容区底部的轻遮罩，
 * 让波浪与更清晰的背景图无缝衔接。
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
          className={`hero-wave-window ${layer.className}`}
          style={{
            height: layer.height,
            animationDuration: `${layer.duration}s`,
            animationDelay: `${layer.delay}s`,
          }}
        >
          {/* 透明度在这一层（静止、无 transform），不在窗口上 —— 见文件头注释 */}
          <div className="hero-wave-layer" style={{ opacity: layer.opacity }}>
            {pageBackground ? (
              <>
                {/*
                  背景图用 fixed：与布局里内容区背景层同一个视口坐标系、同一种 cover。
                  以前这里跟着 transform 轨道平移，且 cover 相对 128px 高的容器取样，
                  和内容区（fixed、整个视口）完全对不上，衔接处就是一条持续的线。
                */}
                <div
                  className="hero-wave-fill"
                  style={{ backgroundImage: `url("${pageBackground}")` }}
                />
                {/*
                  底色遮罩必须匹配**衔接处实际生效的透明度**。
                  内容区的 .page-background-scrim 是 `fixed inset-0` 的**纵向渐变**
                  （顶部 --scrim-top → 中部 → 底部 --scrim-bottom），渐变的 0% 在视口顶部、
                  100% 在视口底部 —— 而波浪衔接处就在视口底部附近，那里生效的是
                  **--scrim-bottom（浅色 22% / 深色 34%）**，不是顶部的 48%。
                  早期这里写死 75%、后来改成 --scrim-top，两次都差出 26%+ 的不透明度，
                  实测衔接处亮度差 46，就是用户看到的「一条割裂的线」。
                */}
                <div
                  className="hero-wave-scrim"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--background) var(--scrim-bottom), transparent)",
                  }}
                />
              </>
            ) : (
              <div className="hero-wave-scrim bg-background" />
            )}

            {/* 波峰提亮：底部渐隐到透明，所以不会和内容区产生接缝 */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--hero-wave-tint),transparent_70%)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
