// 把 Vditor 的运行时资源同步到 public/vditor，使编辑器不依赖外部 CDN。
// 资源体积较大且随依赖版本变化，因此 public/vditor 不入库，由本脚本生成。
//
// 用法：
//   node scripts/sync-vditor.mjs          已同步则跳过
//   node scripts/sync-vditor.mjs --force  强制重新同步

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "node_modules", "vditor", "dist");
// Vditor 运行时按 `${cdn}/dist/js/...` 拼接资源地址（cdn 指向包根目录），
// 因此这里必须落到 public/vditor/dist，再配合 cdn: "/vditor"。
const targetRoot = path.join(projectRoot, "public", "vditor");
const target = path.join(targetRoot, "dist");
const marker = path.join(targetRoot, ".version");

function readVersion() {
  const pkgPath = path.join(projectRoot, "node_modules", "vditor", "package.json");
  if (!fs.existsSync(pkgPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
}

function main() {
  const force = process.argv.includes("--force");
  const version = readVersion();

  if (!version) {
    console.error("[sync-vditor] 未找到 node_modules/vditor，请先执行 npm install");
    process.exitCode = 1;
    return;
  }

  if (!force && fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === version) {
    console.log(`[sync-vditor] 已是 v${version}，跳过`);
    return;
  }

  if (!fs.existsSync(source)) {
    console.error("[sync-vditor] 未找到 node_modules/vditor/dist");
    process.exitCode = 1;
    return;
  }

  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  fs.writeFileSync(marker, version, "utf8");

  console.log(`[sync-vditor] 已同步 vditor v${version} 到 public/vditor/dist`);
}

main();
