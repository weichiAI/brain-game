import path from "node:path";
import { ROOT_DIR, resolveRuntimePort } from "./imagicma-common.mjs";
import { startLoggedProcess } from "./imagicma-runtime-logs.mjs";

const entry = path.join(ROOT_DIR, "dist", "server", "index.js");
const port = await resolveRuntimePort();

await startLoggedProcess({
  processName: "web",
  mode: "start",
  command: process.execPath,
  args: [entry],
  cwd: ROOT_DIR,
  expectedPort: port,
  env: {
    ...process.env,
    PORT: String(port),
    IMAGICMA_SCRIPT_LAUNCH: "1",
    IMAGICMA_LAUNCH_MODE: "start",
  },
});
