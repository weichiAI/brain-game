import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = resolve(rootDir, "client/src/App.tsx");
const homePath = resolve(rootDir, "client/src/pages/home.tsx");
const starterHomeHash =
  "325d25fce6ad0d989235bbd2d491c877643771ad06d7666b83d369ea3ee554a6";

const appSource = readFileSync(appPath, "utf8");
const homeSource = readFileSync(homePath, "utf8");
const isStrict = process.argv.includes("--strict");

const failures = [];

if (!/import\s+Home\s+from\s+["']\.\/pages\/home["'];?/.test(appSource)) {
  failures.push("client/src/App.tsx 必须从 ./pages/home 导入 Home。");
}

if (
  !/<Route\b[^>]*path=["']\/["'][^>]*element=\{\s*<Home\s*\/>\s*\}/s.test(
    appSource,
  )
) {
  failures.push("/ 路由必须直接渲染 client/src/pages/home.tsx 的 Home 组件。");
}

if (!/export\s+default\s+function\s+Home\s*\(/.test(homeSource)) {
  failures.push("client/src/pages/home.tsx 必须导出默认 Home 组件。");
}

const normalizedHome = homeSource.replace(/\s+/g, " ");

const blockedPatterns = [
  [/display\s*:\s*["']?none\b/, "home.tsx 不能通过 display:none 隐藏首页。"],
  [
    /return\s*\(?\s*<([A-Za-z][\w.]*)\b[^>]*(?:\shidden\b|className=["'][^"']*\bhidden\b[^"']*["'])/s,
    "home.tsx 不能把返回的根节点隐藏。",
  ],
  [/请优先修改本页/, "home.tsx 不能保留旧的隐藏占位文案。"],
];

for (const [pattern, message] of blockedPatterns) {
  if (pattern.test(normalizedHome)) {
    failures.push(message);
  }
}

if (isStrict) {
  const homeHash = createHash("sha256").update(homeSource).digest("hex");

  if (homeHash === starterHomeHash) {
    failures.push("业务交付前必须实质修改 client/src/pages/home.tsx，不能保留模板初始首页。");
  }

  if (/return\s+null\b/.test(normalizedHome)) {
    failures.push("业务交付后的 home.tsx 不能返回 null。");
  }

  if (!/<main\b|<section\b|<div\b|<article\b/.test(homeSource)) {
    failures.push("业务交付后的 home.tsx 必须渲染可见页面结构。");
  }

  if (!/text-|font-|bg-|className=/.test(homeSource)) {
    failures.push("业务交付后的 home.tsx 需要包含可见 UI 样式，不能只是空壳结构。");
  }
}

if (failures.length > 0) {
  console.error(isStrict ? "首页交付检查失败：" : "首页入口检查失败：");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(isStrict ? "首页交付检查通过。" : "首页入口检查通过。");
