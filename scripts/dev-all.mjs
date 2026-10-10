import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Start the optional research worker and the Next.js dev server together.
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const children = [
  spawn(process.execPath, ["--experimental-strip-types", "worker/server.ts"], {
    stdio: "inherit",
  }),
  spawn(process.execPath, [next, "dev", "--port", "5173"], { stdio: "inherit" }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exitCode = code || 0;
  });
