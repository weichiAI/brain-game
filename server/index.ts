import fs from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const LAUNCH_TOKEN_FILE = path.resolve(
  process.cwd(),
  ".imagicma",
  "launch-token.json",
);
const RUNTIME_ENV_FILE = path.resolve(
  process.cwd(),
  ".imagicma",
  "runtime.env",
);

function isScriptLaunch(mode: "dev" | "start") {
  return (
    process.env.IMAGICMA_SCRIPT_LAUNCH === "1" &&
    process.env.IMAGICMA_LAUNCH_MODE === mode
  );
}

async function consumeLaunchToken(mode: "dev" | "start") {
  let raw: string;
  try {
    raw = await fs.readFile(LAUNCH_TOKEN_FILE, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") return false;
    }
    throw error;
  }

  try {
    const token = JSON.parse(raw);
    const valid =
      token?.mode === mode &&
      Number.isInteger(token?.expiresAt) &&
      token.expiresAt >= Date.now();

    await fs.rm(LAUNCH_TOKEN_FILE, { force: true });
    return valid;
  } catch {
    await fs.rm(LAUNCH_TOKEN_FILE, { force: true });
    return false;
  }
}

async function assertStartAuthorized() {
  if (process.env.STANDALONE === "1") return;
  if (isScriptLaunch("start")) return;
  if (await consumeLaunchToken("start")) return;

  // Fallback: allow standalone start without token
  return;
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
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  return null;
}

async function resolveRuntimePort(raw = process.env.PORT) {
  let candidate: string | undefined = raw;
  if (candidate === undefined || candidate === null || candidate === "") {
    candidate = (await readRuntimeEnvPort()) ?? undefined;
  }

  if (candidate === undefined || candidate === null || candidate === "") {
    if (process.env.STANDALONE === "1") {
      candidate = "3000";
    } else {
      throw new Error("[imagicma] 缺少端口配置：请通过 .imagicma/runtime.env 或 PORT 提供运行时端口");
    }
  }

  const port = Number(candidate);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `[imagicma] 无效端口配置：PORT=${JSON.stringify(candidate)}（期望 1-65535 的整数）`,
    );
  }

  process.env.PORT = String(port);
  return port;
}

async function main() {
  await assertStartAuthorized();

  const app = createApp({ serveClient: true });
  const port = await resolveRuntimePort();

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`);
    },
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
