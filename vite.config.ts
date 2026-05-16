import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import devServer, { defaultOptions } from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import { imagicmaCartographer } from "./server/imagicma-cartographer-plugin";
import { readPrototypeAsset } from "./server/prototype-preview";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAUNCH_TOKEN_FILE = path.resolve(
  __dirname,
  ".imagicma",
  "launch-token.json",
);
const RUNTIME_ENV_FILE = path.resolve(
  __dirname,
  ".imagicma",
  "runtime.env",
);
const CLIENT_DIR = path.resolve(__dirname, "client");
const CLIENT_PROTOTYPE_DIR = path.join(CLIENT_DIR, "prototype");
const DIST_CLIENT_PROTOTYPE_DIR = path.resolve(
  __dirname,
  "dist",
  "client",
  "prototype",
);

function isScriptLaunch(mode: "dev" | "start") {
  return (
    process.env.IMAGICMA_SCRIPT_LAUNCH === "1" &&
    process.env.IMAGICMA_LAUNCH_MODE === mode
  );
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
    throw new Error("[imagicma] 缺少端口配置：请通过 .imagicma/runtime.env 或 PORT 提供运行时端口");
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

async function assertLaunchAuthorized(mode: "dev" | "start") {
  if (isScriptLaunch(mode)) return;
  if (await consumeLaunchToken(mode)) return;

  throw new Error(
    "[imagicma] 禁止直接使用 vite 启动。请使用 package.json scripts：pnpm dev",
  );
}

function prototypePreviewPlugin() {
  return {
    name: "imagicma-prototype-preview",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const urlPath = new URL(req.url ?? "/", "http://localhost").pathname;

          if (urlPath.startsWith("/prototype/")) {
            const asset = await readPrototypeAsset(CLIENT_PROTOTYPE_DIR, urlPath);
            if (!asset) {
              next();
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", asset.contentType);
            res.end(asset.data);
            return;
          }

          next();
        } catch (error) {
          next(error);
        }
      });
    },
    async closeBundle() {
      try {
        await fs.cp(CLIENT_PROTOTYPE_DIR, DIST_CLIENT_PROTOTYPE_DIR, {
          recursive: true,
          force: true,
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          return;
        }
        throw error;
      }
    },
  };
}

export default defineConfig(async ({ command }) => {
  const runtimePort = command === "serve" ? await resolveRuntimePort() : null;

  if (command === "serve") {
    await assertLaunchAuthorized("dev");
  }

  return {
    root: path.resolve(__dirname, "client"),
    server:
      runtimePort === null
        ? undefined
        : {
            host: "0.0.0.0",
            port: runtimePort,
            allowedHosts: ["localhost", "127.0.0.1", ".imagicma.cn", ".agentma.cn", ".agentma.com"],
            strictPort: true,
            hmr: { overlay: false },
    },
    plugins: [
      imagicmaCartographer({ root: path.resolve(__dirname, "client") }),
      react(),
      prototypePreviewPlugin(),
      devServer({
        entry: path.resolve(__dirname, "server/dev-app.ts"),
        adapter: nodeAdapter,
        exclude: [/^\/(?!(?:api|__health)(?:\/|$)).*/, ...defaultOptions.exclude],
      }),
      {
        name: "imagicma-runtime-port",
        configResolved(resolvedConfig: import("vite").ResolvedConfig) {
          if (resolvedConfig.command !== "serve" || runtimePort === null) return;
          resolvedConfig.server.port = runtimePort;
          resolvedConfig.server.strictPort = true;
          resolvedConfig.server.host = "0.0.0.0";
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    build: {
      outDir: path.resolve(__dirname, "dist/client"),
      emptyOutDir: true,
    },
  };
});
