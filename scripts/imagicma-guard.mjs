import { ensureCanonicalScripts, writeLaunchToken } from "./imagicma-common.mjs";

const mode = process.argv[2];

if (mode !== "dev" && mode !== "start") {
  console.error("[imagicma] guard 参数错误，仅支持 dev/start");
  process.exit(1);
}

const repaired = await ensureCanonicalScripts();
if (repaired) {
  console.warn(
    "[imagicma] 检测到 package.json scripts 被修改，已自动恢复为受保护启动命令。",
  );
}

await writeLaunchToken(mode);
