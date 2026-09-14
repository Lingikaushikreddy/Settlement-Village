import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--experimental-strip-types", "worker/server.ts"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["scripts/run-framework.mjs", "dev", "--host", "127.0.0.1"],
    { stdio: "inherit" },
  ),
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
