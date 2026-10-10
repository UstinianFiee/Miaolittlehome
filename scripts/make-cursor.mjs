/**
 * 生成站点自定义光标：媒体库里的小猫图 + 左上角一个「小尖尖」。
 *
 * 光标的热点在图片左上角，所以尖端必须画在 (1,1) 附近，
 * 否则用户会觉得「点击位置和看到的位置不一致」。
 *
 * 输出到 public/cursor-cat.png（CSS 里用 url("/cursor-cat.png") 引用）。
 * 用法：node scripts/make-cursor.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";

const req = createRequire("E:/tr/workbuddyProject/Blog/");
const sharp = req("sharp");

const SOURCE = "uploads/2026/10/mv22072e-9e2fe201.png";
const TARGET = "public/cursor-cat.png";

const SIZE = 34;
const CAT = 30;
const OFFSET = 4;

if (!fs.existsSync(SOURCE)) {
  throw new Error(`找不到小猫原图：${SOURCE}`);
}

const cat = await sharp(SOURCE)
  .resize(CAT, CAT, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

// 尖端：白填充 + 深描边，深浅背景下都看得清
const tip = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
     <path d="M1.2 1.2 L12 4.6 L4.6 12 Z"
           fill="#ffffff" stroke="#141414" stroke-width="1.6" stroke-linejoin="round" />
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
    { input: cat, top: OFFSET, left: OFFSET },
    // 尖端画在最上层，保证不被猫身盖住
    { input: tip, top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(TARGET);

const stat = fs.statSync(TARGET);
console.log(`已生成 ${TARGET}：${SIZE}×${SIZE}，${(stat.size / 1024).toFixed(1)}KB（热点 2 2）`);
