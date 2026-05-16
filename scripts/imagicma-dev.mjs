import path from "node:path";
import { ROOT_DIR, resolveRuntimePort } from "./imagicma-common.mjs";
import { startLoggedProcess } from "./imagicma-runtime-logs.mjs";

const viteBin = path.join(ROOT_DIR, "node_modules", "vite", "bin", "vite.js");
const port = await resolveRuntimePort();

await startLoggedProcess({
  processName: "web",
  mode: "dev",
  command: process.execPath,
  args: [viteBin, "--host", "0.0.0.0", "--strictPort"],
  cwd: ROOT_DIR,
  expectedPort: port,
  env: {
    ...process.env,
    PORT: String(port),
    IMAGICMA_SCRIPT_LAUNCH: "1",
    IMAGICMA_LAUNCH_MODE: "dev",
  },
});
