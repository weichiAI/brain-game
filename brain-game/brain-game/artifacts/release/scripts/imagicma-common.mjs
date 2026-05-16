import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "..");
export const RUNTIME_ENV_FILE = path.join(ROOT_DIR, ".imagicma", "runtime.env");
export const LAUNCH_TOKEN_FILE = path.join(
  ROOT_DIR,
  ".imagicma",
  "launch-token.json",
);
export const PACKAGE_JSON_FILE = path.join(ROOT_DIR, "package.json");

export const CANONICAL_SCRIPTS = {
  predev: "node ./scripts/imagicma-guard.mjs dev",
  dev: "node ./scripts/imagicma-dev.mjs",
  prestart: "node ./scripts/imagicma-guard.mjs start",
  start: "node ./scripts/imagicma-start.mjs",
};

function isValidPort(value) {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

async function readRuntimeEnvPort() {
  try {
    const raw = await fs.readFile(RUNTIME_ENV_FILE, "utf8");
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      if (key !== "PORT") continue;
      return trimmed.slice(separatorIndex + 1).trim();
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  return null;
}

export async function resolveRuntimePort(raw = process.env.PORT) {
  let candidate = raw;
  if (candidate === undefined || candidate === null || candidate === "") {
    candidate = await readRuntimeEnvPort();
  }

  if (candidate === undefined || candidate === null || candidate === "") {
    throw new Error(
      "缺少端口配置：请通过环境变量 PORT 或项目内 .imagicma/runtime.env 提供 PORT",
    );
  }

  const port = Number(candidate);
  if (!isValidPort(port)) {
    throw new Error(
      `无效端口配置：PORT=${JSON.stringify(candidate)}（期望 1-65535 的整数）`,
    );
  }

  process.env.PORT = String(port);
  return port;
}

export async function ensureRuntimeEnvDir() {
  await fs.mkdir(path.dirname(RUNTIME_ENV_FILE), { recursive: true });
}

export async function writeRuntimeEnvPort(port) {
  if (port === undefined || port === null || port === "") {
    throw new Error("写入 runtime.env 前缺少 PORT");
  }

  if (!isValidPort(port)) {
    throw new Error(
      `无效端口配置：PORT=${JSON.stringify(port)}（期望 1-65535 的整数）`,
    );
  }

  await ensureRuntimeEnvDir();
  await fs.writeFile(RUNTIME_ENV_FILE, `PORT=${port}\n`);
}

export async function readPackageJson() {
  const raw = await fs.readFile(PACKAGE_JSON_FILE, "utf8");
  const pkg = JSON.parse(raw);
  return { raw, pkg };
}

export async function writePackageJson(pkg) {
  await fs.writeFile(PACKAGE_JSON_FILE, `${JSON.stringify(pkg, null, 2)}\n`);
}

export async function writeLaunchToken(mode) {
  await fs.mkdir(path.dirname(LAUNCH_TOKEN_FILE), { recursive: true });
  const expiresAt = Date.now() + 30 * 1000;
  const token = {
    mode,
    nonce: crypto.randomUUID(),
    expiresAt,
  };
  await fs.writeFile(LAUNCH_TOKEN_FILE, `${JSON.stringify(token, null, 2)}\n`);
  return token;
}

export async function consumeLaunchToken(mode) {
  let raw;
  try {
    raw = await fs.readFile(LAUNCH_TOKEN_FILE, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  try {
    const token = JSON.parse(raw);
    const isValid =
      token?.mode === mode &&
      Number.isInteger(token?.expiresAt) &&
      token.expiresAt >= Date.now();

    if (!isValid) {
      await fs.rm(LAUNCH_TOKEN_FILE, { force: true });
      return false;
    }

    await fs.rm(LAUNCH_TOKEN_FILE, { force: true });
    return true;
  } catch {
    await fs.rm(LAUNCH_TOKEN_FILE, { force: true });
    return false;
  }
}

export async function ensureCanonicalScripts() {
  const { pkg } = await readPackageJson();
  const currentScripts = pkg.scripts ?? {};

  let mutated = false;
  for (const [name, expected] of Object.entries(CANONICAL_SCRIPTS)) {
    if (currentScripts[name] !== expected) {
      mutated = true;
      currentScripts[name] = expected;
    }
  }

  if (mutated) {
    pkg.scripts = currentScripts;
    await writePackageJson(pkg);
  }

  return mutated;
}
