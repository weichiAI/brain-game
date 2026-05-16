import crypto from "node:crypto";
import rawFs from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT_DIR } from "./imagicma-common.mjs";

const RUNTIME_ROOT = path.join(ROOT_DIR, ".imagicma", "runtime");
const HISTORY_ROOT = path.join(RUNTIME_ROOT, ".history");
const WORKFLOW_EVENT_LOG = path.join(RUNTIME_ROOT, "events.jsonl");
const ANSI_PATTERN =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|(?:\d{1,4}(?:;\d{0,4})*)?)[\dA-PR-TZcf-nq-uy=><~])/g;
const WARNING_PATTERN = /\b(warn|warning|deprecated|postcss)\b/i;
const STARTUP_READY_PATTERN = /\b(VITE\b.*ready|Local:\s+http:\/\/|Server listening on port)\b/i;

function createLaunchId() {
  return crypto.randomBytes(15).toString("base64url");
}

function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, "").replace(/\r/g, "");
}

function redactSecrets(value) {
  return value
    .replace(/(Authorization:\s*)(.+)$/gi, "$1[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/g, "Bearer [REDACTED]")
    .replace(/([?&](?:api[_-]?key|token|access[_-]?token|session|cookie)=)([^&\s]+)/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|session|cookie)\s*[:=]\s*)(["']?)[^\s"']+\2/gi, "$1[REDACTED]")
    .replace(
      /\b((?:postgres(?:ql)?|mysql|mariadb|redis):\/\/[^:\s/]+:)([^@\s/]+)(@)/gi,
      "$1[REDACTED]$3",
    );
}

function sanitizePersistedLine(value) {
  return redactSecrets(stripAnsi(value));
}

function inferLevel(text) {
  if (/\b(error|fatal|exception|traceback|unhandled)\b/i.test(text)) return "error";
  if (WARNING_PATTERN.test(text)) return "warning";
  return "info";
}

function parsePortFromText(text) {
  const localMatch = text.match(/Local:\s+http:\/\/[^:]+:(\d+)/i);
  if (localMatch?.[1]) return Number(localMatch[1]);
  const listenMatch = text.match(/Server listening on port (\d+)/i);
  if (listenMatch?.[1]) return Number(listenMatch[1]);
  return null;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendWorkflowEvent(payload) {
  await fs.mkdir(path.dirname(WORKFLOW_EVENT_LOG), { recursive: true });
  await fs.appendFile(
    WORKFLOW_EVENT_LOG,
    `${JSON.stringify({
      tsMs: Date.now(),
      source: "wrapper",
      ...payload,
    })}\n`,
    "utf8",
  );
}

async function pruneOldRuns(processName, keep = 5) {
  const historyDir = path.join(HISTORY_ROOT, processName);
  let entries;
  try {
    entries = await fs.readdir(historyDir, { withFileTypes: true });
  } catch {
    return;
  }

  const jsonEntries = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const absolutePath = path.join(historyDir, entry.name);
        const stat = await fs.stat(absolutePath);
        return {
          absolutePath,
          launchId: entry.name.slice(0, -".json".length),
          mtimeMs: stat.mtimeMs,
        };
      }),
  );

  jsonEntries.sort((left, right) => right.mtimeMs - left.mtimeMs);
  for (const stale of jsonEntries.slice(keep)) {
    await fs.rm(stale.absolutePath, { force: true });
    await fs.rm(path.join(historyDir, `${stale.launchId}.log`), { force: true });
  }
}

export async function startLoggedProcess({
  processName,
  mode,
  command,
  args,
  cwd = ROOT_DIR,
  env,
  expectedPort = null,
}) {
  const launchId = createLaunchId();
  const historyDir = path.join(HISTORY_ROOT, processName);
  const currentLogPath = path.join(RUNTIME_ROOT, `${processName}.log`);
  const currentMetadataPath = path.join(RUNTIME_ROOT, `${processName}.json`);
  const historyLogPath = path.join(historyDir, `${launchId}.log`);
  const historyMetadataPath = path.join(historyDir, `${launchId}.json`);

  const metadata = {
    schemaVersion: 2,
    processName,
    mode,
    launchId,
    command: [command, ...args],
    cwd,
    pid: null,
    port: expectedPort,
    status: "launching",
    startedAtMs: Date.now(),
    startupCompletedAtMs: null,
    exitedAtMs: null,
    exitCode: null,
  };

  const persistMetadata = async () => {
    await writeJson(currentMetadataPath, metadata);
    await writeJson(historyMetadataPath, metadata);
  };

  await fs.mkdir(historyDir, { recursive: true });
  await fs.mkdir(RUNTIME_ROOT, { recursive: true });
  await fs.writeFile(currentLogPath, "", "utf8");
  await fs.writeFile(historyLogPath, "", "utf8");
  await persistMetadata();
  await appendWorkflowEvent({
    event: "launch_requested",
    processName,
    launchId,
    port: expectedPort,
    status: "requested",
    message: `${mode} launch requested`,
  });

  const child = spawn(command, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    env,
  });

  metadata.pid = child.pid ?? null;
  metadata.status = "running";
  await persistMetadata();
  await appendWorkflowEvent({
    event: "launch_started",
    processName,
    launchId,
    pid: metadata.pid,
    port: expectedPort,
    status: "running",
    message: `${mode} launch started`,
  });

  const currentWriteStream = rawFs.createWriteStream(currentLogPath, { flags: "a" });
  const historyWriteStream = rawFs.createWriteStream(historyLogPath, { flags: "a" });
  const streamBuffers = {
    stdout: "",
    stderr: "",
  };
  let lineQueue = Promise.resolve();
  let observedOutput = false;
  let portReadyEmitted = false;
  let startupCompleted = false;

  const handleLine = async (stream, line) => {
    const clean = sanitizePersistedLine(line);
    if (!clean.trim()) return;

    const record = `${new Date().toISOString()} ${stream} ${clean}\n`;
    currentWriteStream.write(record);
    historyWriteStream.write(record);

    if (!observedOutput) {
      observedOutput = true;
      await appendWorkflowEvent({
        event: "stdout_observed",
        processName,
        launchId,
        pid: metadata.pid,
        port: metadata.port,
        status: "running",
        message: `first ${stream} output observed`,
      });
    }

    const detectedPort = parsePortFromText(clean) ?? metadata.port ?? expectedPort ?? null;
    if (detectedPort && !portReadyEmitted && /Local:\s+http:\/\/|Server listening on port/i.test(clean)) {
      portReadyEmitted = true;
      if (!metadata.port) {
        metadata.port = detectedPort;
        await persistMetadata();
      }
      await appendWorkflowEvent({
        event: "port_ready",
        processName,
        launchId,
        pid: metadata.pid,
        port: detectedPort,
        status: "ready",
        message: clean,
      });
    }

    if (!startupCompleted && STARTUP_READY_PATTERN.test(clean)) {
      startupCompleted = true;
      metadata.startupCompletedAtMs = Date.now();
      metadata.status = "ready";
      await persistMetadata();
      await appendWorkflowEvent({
        event: "startup_completed",
        processName,
        launchId,
        pid: metadata.pid,
        port: metadata.port,
        status: "ready",
        message: clean,
      });
    }

    if (inferLevel(clean) !== "info") {
      await appendWorkflowEvent({
        event: "warning_detected",
        processName,
        launchId,
        pid: metadata.pid,
        port: metadata.port,
        status: inferLevel(clean),
        message: clean,
      });
    }
  };

  const enqueueLines = (stream, chunk, target) => {
    target.write(chunk);
    streamBuffers[stream] += chunk.toString("utf8");
    const parts = streamBuffers[stream].split(/\n/);
    streamBuffers[stream] = parts.pop() ?? "";
    for (const part of parts) {
      const normalized = part.replace(/\r/g, "");
      lineQueue = lineQueue.then(() => handleLine(stream, normalized));
    }
  };

  child.stdout.on("data", (chunk) => enqueueLines("stdout", chunk, process.stdout));
  child.stderr.on("data", (chunk) => enqueueLines("stderr", chunk, process.stderr));

  const flushBufferedLines = () => {
    for (const [stream, value] of Object.entries(streamBuffers)) {
      const normalized = value.replace(/\r/g, "").trimEnd();
      if (!normalized) continue;
      lineQueue = lineQueue.then(() => handleLine(stream, normalized));
      streamBuffers[stream] = "";
    }
  };

  child.on("close", async (code) => {
    flushBufferedLines();
    await lineQueue;
    currentWriteStream.end();
    historyWriteStream.end();
    metadata.exitedAtMs = Date.now();
    metadata.exitCode = code ?? 0;
    metadata.status = (code ?? 0) === 0 ? "exited" : "failed";
    await persistMetadata();
    await appendWorkflowEvent({
      event: "process_exit",
      processName,
      launchId,
      pid: metadata.pid,
      port: metadata.port,
      status: metadata.status,
      message: `${mode} process exited with code ${code ?? 0}`,
    });
    await pruneOldRuns(processName);
    process.exit(code ?? 0);
  });

  child.on("error", async (error) => {
    console.error(`[imagicma] 启动 ${mode} 失败：${error.message}`);
    metadata.exitedAtMs = Date.now();
    metadata.status = "failed";
    await persistMetadata();
    await appendWorkflowEvent({
      event: "process_exit",
      processName,
      launchId,
      pid: metadata.pid,
      port: metadata.port,
      status: "failed",
      message: error.message,
    });
    process.exit(1);
  });

  return child;
}
