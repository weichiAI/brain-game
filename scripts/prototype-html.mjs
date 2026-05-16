import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const prototypeRoot = path.join(rootDir, "client", "prototype");
const currentConfigPath = path.join(prototypeRoot, "current.json");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;

    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function assertPrototypeRelative(label, value) {
  if (!value || typeof value !== "string") {
    throw new Error(`[prototype] 缺少参数：--${label}`);
  }

  if (path.isAbsolute(value)) {
    throw new Error(`[prototype] --${label} 必须是 client/prototype 内的相对路径。`);
  }

  const resolved = path.resolve(prototypeRoot, value);
  const relative = path.relative(prototypeRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`[prototype] --${label} 必须位于 client/prototype 内。`);
  }

  return value;
}

async function activate(args) {
  assertPrototypeRelative("entry", args.entry);
  assertPrototypeRelative("inputs", args.inputs);
  throw new Error(
    "[prototype] 当前模板只支持 React 交付：请写入 client/src/pages/home.tsx。",
  );
}

async function prepare() {
  await fs.mkdir(path.join(prototypeRoot, "current", "assets"), { recursive: true });
  console.log("[prototype] 已准备目录：client/prototype/current/");
}

async function switchToReact() {
  await fs.mkdir(prototypeRoot, { recursive: true });
  await fs.writeFile(
    currentConfigPath,
    `${JSON.stringify({ mode: "react", updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  console.log("[prototype] 已切换到 React 模式，保留 client/prototype/current/。");
}

async function main() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  if (command === "prepare") {
    await prepare();
    return;
  }

  if (command === "activate") {
    await activate(args);
    return;
  }

  if (command === "react") {
    await switchToReact();
    return;
  }

  throw new Error(
    "用法：node scripts/prototype-html.mjs <prepare|activate|react> --entry current/index.html --inputs current/inputs.json [--skill name] [--title title]",
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
