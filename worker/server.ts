import { modelConfig, modelStatus, modelStep } from "./model.ts";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
  readFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { RunStore } from "./store.ts";
import type { Command } from "./store.ts";
const port = Number(process.env.SETTLEMENT_WORKER_PORT || 8787);
const path = resolve(process.env.SETTLEMENT_DB || "work/settlement.sqlite");
mkdirSync(dirname(path), { recursive: true });
// An exclusive process lock keeps this local SQLite deployment single-writer.
const lockPath = path + ".lock";
let lock: number;
try {
  lock = openSync(lockPath, "wx");
} catch {
  const pid = Number(readFileSync(lockPath, "utf8"));
  let live = false;
  try {
    process.kill(pid, 0);
    live = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") live = true;
  }
  if (live) throw Error("Another Settlement worker owns this database");
  unlinkSync(lockPath);
  lock = openSync(lockPath, "wx");
}
const { writeSync } = await import("node:fs");
writeSync(lock, String(process.pid));
const store = new RunStore(path);
const provider = modelConfig(process.env);
const allowed = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const streams = new Map<string, Set<ServerResponse>>();
let subscribers = 0;
function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
function publish(id: string) {
  const clients = streams.get(id);
  if (!clients?.size) return;
  const value = store.get(id);
  const line = `id: ${value.version}\ndata: ${JSON.stringify(value)}\n\n`;
  for (const res of clients) {
    if (res.writableLength > 2000000) {
      res.end();
      continue;
    }
    res.write(line);
  }
}
async function body(req: IncomingMessage) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16384) throw Error("Request too large");
  }
  return JSON.parse(raw || "{}");
}
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const host = req.headers.host || "";
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host))
    return send(res, 403, { error: "Invalid host" });
  if (origin && !allowed.has(origin))
    return send(res, 403, { error: "Origin not allowed" });
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Last-Event-ID",
    });
    res.end();
    return;
  }
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (req.method === "GET" && url.pathname === "/health")
      return send(res, 200, {
        ok: true,
        mode: "deterministic",
        modelCallsEnabled: modelStatus(provider).ready,
      });
    if (req.method === "GET" && url.pathname === "/model/status")
      return send(res, 200, {
        ...modelStatus(provider),
        ...store.modelUsage(),
      });
    if (req.method === "GET" && url.pathname === "/runs")
      return send(res, 200, { runs: store.list() });
    if (
      req.method === "POST" &&
      !req.headers["content-type"]?.startsWith("application/json")
    )
      return send(res, 415, { error: "JSON content type required" });
    if (req.method === "POST" && url.pathname === "/runs")
      return send(res, 201, store.create(await body(req)));
    if (parts[0] === "runs" && parts[1]) {
      const id = parts[1];
      if (req.method === "GET" && parts.length === 2)
        return send(res, 200, store.get(id));
      if (req.method === "POST" && parts[2] === "model-step") {
        if (!origin || !allowed.has(origin))
          return send(res, 403, {
            error: "Model steps require an allowed application origin",
          });
        const result = await modelStep(store, id, await body(req), provider);
        send(res, 200, result);
        publish(id);
        return;
      }
      if (req.method === "POST" && parts[2] === "commands") {
        const result = store.command(id, (await body(req)) as Command);
        send(res, 200, result);
        publish(id);
        return;
      }
      if (req.method === "GET" && parts[2] === "stream") {
        store.get(id);
        if (subscribers >= 20)
          return send(res, 429, { error: "Too many live viewers" });
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write("retry: 1500\n\n");
        if (!streams.has(id)) streams.set(id, new Set());
        streams.get(id)!.add(res);
        subscribers++;
        publish(id);
        const heartbeat = setInterval(
          () => res.write(": keepalive\n\n"),
          15000,
        );
        req.on("close", () => {
          clearInterval(heartbeat);
          streams.get(id)?.delete(res);
          subscribers--;
          if (!streams.get(id)?.size) streams.delete(id);
        });
        return;
      }
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    send(
      res,
      message.includes("not found")
        ? 404
        : message.includes("version")
          ? 409
          : 400,
      { error: message },
    );
  }
});
const timer = setInterval(() => {
  for (const id of store.active()) {
    try {
      store.tick(id);
      publish(id);
    } catch (e) {
      console.error(
        "Tick failed for run",
        id,
        e instanceof Error ? e.message : "Unknown failure",
      );
    }
  }
}, 1000);
server.on("error", (error) => {
  clearInterval(timer);
  store.close();
  closeSync(lock);
  try {
    if (readFileSync(lockPath, "utf8") === String(process.pid))
      unlinkSync(lockPath);
  } catch {}
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Settlement worker: http://127.0.0.1:${port} (local only; model steps ${modelStatus(provider).ready ? "configured, explicit action required" : "disabled"})`,
  ),
);
function shutdown() {
  clearInterval(timer);
  for (const clients of streams.values()) for (const res of clients) res.end();
  server.close(() => {
    store.close();
    closeSync(lock);
    unlinkSync(lockPath);
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
