/**
 * 生成站点的自定义小猫光标（public/cursor-cat.png）。
 *
 * 布局：左上角「小尖头」标出真实点击点，小猫主体向右下错开一段距离，
 * 两者之间留出空隙 —— 之前尖头直接压在小猫脑袋上，视觉上分不清哪个是鼠标指针。
 * 光标热点由 CSS 的 `url(...) 2 2` 决定，尖头尖端必须画在 (1~2, 1~2) 附近，
 * 否则用户会觉得「点到的位置和看到的位置不一致」。
 *
 * 画布保持 32×32（各平台对自定义光标尺寸都有上限，超过容易被缩放或忽略）。
 *
 * 用法：node scripts/make-cursor.mjs [小猫原图路径]
 * 默认原图：uploads/2026/10/mv22072e-9e2fe201.png（站长的猫图，不入库；
 * 换机器/CI 重新生成时把原图放回该路径，或用参数传入）。
 * 输出：public/cursor-cat.png（CSS 里用 url("/cursor-cat.png") 引用）。
 */
import fs from "node:fs";

import sharp from "sharp";

const SOURCE = process.argv[2] ?? "uploads/2026/10/mv22072e-9e2fe201.png";
const TARGET = "public/cursor-cat.png";

/** 光标画布边长（36 够放下更大的尖头，同时保住猫身尺寸；Chromium 支持到 128） */
const SIZE = 36;
/** 小猫主体边长与偏移：向右下错开，和尖头留约 1px 空隙 */
const CAT = 24;
const CAT_LEFT = 12;
const CAT_TOP = 10;

if (!fs.existsSync(SOURCE)) {
  throw new Error(
    `找不到小猫原图：${SOURCE}\n把原图放到该路径，或用 node scripts/make-cursor.mjs <路径> 指定。`
  );
}

const cat = await sharp(SOURCE)
  .resize(CAT, CAT, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

// 尖头：白填充 + 深描边，深浅背景下都能看清；尖端在 (1.4,1.4)，贴近热点 (2,2)
// 尺寸比最初版本放大到约 10px（太小的尖头看起来不像鼠标指针）
const tip = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
     <path d="M1.4 1.4 L10.8 4.9 L4.9 10.8 Z"
           fill="#ffffff" stroke="#141414" stroke-width="1.5" stroke-linejoin="round" />
   </svg>`
);

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: cat, top: CAT_TOP, left: CAT_LEFT },
    // 尖头画在最上层，保证不被猫身盖住
    { input: tip, top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(TARGET);

const stat = fs.statSync(TARGET);
console.log(
  `已生成 ${TARGET}（${SIZE}×${SIZE}，${(stat.size / 1024).toFixed(1)}KB，热点 2 2）`
);
