import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { RUNTIME_ENV_FILE, writeRuntimeEnvPort } from "./imagicma-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isPackagedRelease = path.basename(rootDir) === "release";
const sourceDistDir = path.join(rootDir, "dist");
const releaseRootDir = isPackagedRelease ? rootDir : path.join(rootDir, "artifacts", "release");
const legacyReleaseRootDir = path.join(rootDir, "release");
const packageJsonPath = path.join(rootDir, "package.json");
const sourceDataDir = path.join(rootDir, ".data");

const runtimeDependencies = [
  "@hono/node-server",
  "better-sqlite3",
  "hono",
  "pg",
  "reflect-metadata",
  "typeorm",
  "zod",
];

const copiedScripts = [
  "imagicma-common.mjs",
  "imagicma-runtime-logs.mjs",
  "imagicma-start.mjs",
  "release-tool.mjs",
];

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function ensureCopiedDir(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath))) {
    throw new Error(`[release] 缺少所需目录：${path.relative(rootDir, sourcePath)}`);
  }

  await ensureDir(path.dirname(targetPath));
  await fs.cp(sourcePath, targetPath, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function copyRuntimeDataForRelease() {
  if (!(await pathExists(sourceDataDir))) {
    console.log("[release] 未找到 .data 目录，跳过 artifacts/release/.data。");
    return;
  }

  await ensureCopiedDir(sourceDataDir, path.join(releaseRootDir, ".data"));
}

async function writeReleasePackageJson() {
  const sourcePackageJson = await readJson(packageJsonPath);
  const dependencies = Object.fromEntries(
    runtimeDependencies.map((name) => {
      const version = sourcePackageJson.dependencies?.[name];
      if (!version) {
        throw new Error(`[release] package.json 缺少运行时依赖版本：${name}`);
      }
      return [name, version];
    }),
  );

  const releasePackageJson = {
    name: `${sourcePackageJson.name}-release`,
    version: sourcePackageJson.version,
    private: true,
    scripts: {
      start: "node ./scripts/release-tool.mjs start",
      init: "node ./scripts/release-tool.mjs init",
    },
    dependencies,
    pnpm: sourcePackageJson.pnpm,
    engines: {
      node: ">=20",
    },
  };

  await fs.writeFile(
    path.join(releaseRootDir, "package.json"),
    `${JSON.stringify(releasePackageJson, null, 2)}\n`,
    "utf8",
  );
}

async function writeRuntimeEnv() {
  const releaseRuntimeEnv = path.join(releaseRootDir, ".imagicma", "runtime.env");
  await ensureDir(path.dirname(releaseRuntimeEnv));

  if (await pathExists(RUNTIME_ENV_FILE)) {
    await fs.copyFile(RUNTIME_ENV_FILE, releaseRuntimeEnv);
    return;
  }

  await fs.writeFile(releaseRuntimeEnv, "PORT=3000\n", "utf8");
}

async function copyEnvFiles() {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const envFiles = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(".env"))
    .map((entry) => entry.name)
    .sort();

  for (const filename of envFiles) {
    await fs.copyFile(
      path.join(rootDir, filename),
      path.join(releaseRootDir, filename),
    );
  }
}

async function copyScripts() {
  for (const filename of copiedScripts) {
    await ensureDir(path.join(releaseRootDir, "scripts"));
    await fs.copyFile(
      path.join(rootDir, "scripts", filename),
      path.join(releaseRootDir, "scripts", filename),
    );
  }
}

async function writeShellEntrypoints() {
  const files = [
    {
      filename: "init.sh",
      content: "#!/usr/bin/env sh\nset -eu\nnode ./scripts/release-tool.mjs init \"$@\"\n",
    },
    {
      filename: "start.sh",
      content: "#!/usr/bin/env sh\nset -eu\nnpm start\n",
    },
  ];

  for (const file of files) {
    const targetPath = path.join(releaseRootDir, file.filename);
    await fs.writeFile(targetPath, file.content, "utf8");
    await fs.chmod(targetPath, 0o755);
  }
}

async function writeReleaseReadme() {
  const readme = `# Release Package

这个目录可直接作为部署包使用，不包含 \`node_modules\`。

## 首次部署

\`\`\`bash
./init.sh
\`\`\`

如需指定端口：

\`\`\`bash
./init.sh 5011
\`\`\`

初始化脚本会：

- 安装生产依赖（\`npm install --omit=dev\`）
- 创建运行时目录
- 写入 \`.imagicma/runtime.env\`

## 环境文件

发布目录会包含：

- 源项目根目录下的所有 \`.env*\` 文件，都会原封不动复制到发布目录

\`npm start\`（以及薄封装的 \`./start.sh\`）会按顺序自动加载：

1. \`.env\`
2. \`.env.\${NODE_ENV}\`（如果设置了 \`NODE_ENV\`）
3. \`.env.local\`
4. \`.env.\${NODE_ENV}.local\`（如果设置了 \`NODE_ENV\`）

如果你需要覆盖数据库、AI、支付、短信等配置，可以直接编辑发布目录里的对应 \`.env*\` 文件。

注意：既然是“原封不动复制”，如果源项目里的 \`.env.local\` 含有敏感信息，这些内容也会一起进入发布包。

## 启动

\`\`\`bash
npm start
\`\`\`

或：

\`\`\`bash
./start.sh
\`\`\`

## 使用 PM2

首次初始化后，可用 PM2 守护运行：

\`\`\`bash
pm2 start npm --name web-app -- start
\`\`\`

常用命令：

\`\`\`bash
pm2 status
pm2 logs web-app
pm2 restart web-app
pm2 stop web-app
pm2 delete web-app
\`\`\`

如需开机自启：

\`\`\`bash
pm2 save
pm2 startup
\`\`\`
`;

  await fs.writeFile(path.join(releaseRootDir, "README.md"), readme, "utf8");
}

function resolveRequestedPort() {
  const cliPort = process.argv[3]?.trim();
  if (cliPort) return cliPort;

  if (process.env.PORT?.trim()) return process.env.PORT.trim();

  return null;
}

async function ensureRuntimePortForInit() {
  const requestedPort = resolveRequestedPort();

  if (requestedPort) {
    await writeRuntimeEnvPort(Number(requestedPort));
    console.log(`[init] 已写入运行端口到 ${path.relative(rootDir, RUNTIME_ENV_FILE)}: ${requestedPort}`);
    return requestedPort;
  }

  try {
    const existing = await fs.readFile(RUNTIME_ENV_FILE, "utf8");
    const line = existing
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.startsWith("PORT="));

    if (line) {
      const port = line.slice("PORT=".length).trim();
      console.log(`[init] 沿用现有运行端口: ${port}`);
      return port;
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const fallbackPort = 3000;
  await writeRuntimeEnvPort(fallbackPort);
  console.log(`[init] 未检测到运行端口，已写入默认端口: ${fallbackPort}`);
  return String(fallbackPort);
}

async function installProductionDependencies() {
  if (await pathExists(path.join(rootDir, "node_modules"))) {
    console.log("[init] 已检测到 node_modules，跳过依赖安装。");
    return;
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log("[init] 开始安装生产依赖：npm install --omit=dev --no-fund --no-audit");

  await new Promise((resolve, reject) => {
    const child = spawn(
      npmCmd,
      ["install", "--omit=dev", "--no-fund", "--no-audit"],
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(null);
        return;
      }
      reject(new Error(`[init] 生产依赖安装失败，退出码 ${code ?? "unknown"}`));
    });
  });
}

function resolveEnvLoadOrder() {
  const files = [".env"];

  if (process.env.NODE_ENV?.trim()) {
    files.push(`.env.${process.env.NODE_ENV.trim()}`);
  }

  files.push(".env.local");

  if (process.env.NODE_ENV?.trim()) {
    files.push(`.env.${process.env.NODE_ENV.trim()}.local`);
  }

  return files;
}

async function createReleaseRuntimeEnv() {
  const env = { ...process.env };
  const initialKeys = new Set(Object.keys(process.env));
  initialKeys.add("PORT");

  for (const filename of resolveEnvLoadOrder()) {
    const filePath = path.join(rootDir, filename);
    if (!(await pathExists(filePath))) continue;

    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseEnv(raw);

    for (const [key, value] of Object.entries(parsed)) {
      if (initialKeys.has(key)) continue;
      env[key] = value;
    }
  }

  return env;
}

async function startRelease() {
  const runtimeEnv = await createReleaseRuntimeEnv();

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["./scripts/imagicma-start.mjs"], {
      cwd: rootDir,
      stdio: "inherit",
      env: runtimeEnv,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(null);
        return;
      }
      reject(new Error(`[start] 启动失败，退出码 ${code ?? "unknown"}`));
    });
  });
}

async function prepareRelease() {
  if (!isPackagedRelease) {
    await fs.rm(legacyReleaseRootDir, { recursive: true, force: true });
  }
  await fs.rm(releaseRootDir, { recursive: true, force: true });

  await ensureCopiedDir(path.join(sourceDistDir, "client"), path.join(releaseRootDir, "dist", "client"));
  await ensureCopiedDir(path.join(sourceDistDir, "server"), path.join(releaseRootDir, "dist", "server"));
  await ensureCopiedDir(path.join(sourceDistDir, "shared"), path.join(releaseRootDir, "dist", "shared"));
  await copyRuntimeDataForRelease();
  await copyScripts();
  await writeReleasePackageJson();
  await writeRuntimeEnv();
  await writeShellEntrypoints();
  await writeReleaseReadme();
  await copyEnvFiles();

  console.log(`[release] 已生成发布目录：${path.relative(rootDir, releaseRootDir)}`);
}

async function initializeRelease() {
  await ensureDir(path.join(rootDir, ".imagicma"));
  await ensureDir(path.join(rootDir, ".data"));
  const port = await ensureRuntimePortForInit();
  await installProductionDependencies();

  console.log("");
  console.log("[init] 初始化完成。");
  console.log(`[init] 当前启动端口: ${port}`);
  console.log("[init] 启动命令: npm start");
}

async function main() {
  const command = process.argv[2];

  if (command === "prepare") {
    await prepareRelease();
    return;
  }

  if (command === "init") {
    await initializeRelease();
    return;
  }

  if (command === "start") {
    await startRelease();
    return;
  }

  throw new Error("用法：node ./scripts/release-tool.mjs <prepare|init|start> [port]");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
