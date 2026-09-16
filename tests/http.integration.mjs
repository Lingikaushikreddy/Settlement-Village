import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("worker HTTP controls, origin protection and event stream form one working flow", async () => {
  const dir = mkdtempSync(join(tmpdir(), "settlement-http-"));
  const base = "http://127.0.0.1:8899";
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "worker/server.ts"],
    {
      env: {
        ...process.env,
        SETTLEMENT_LIVE_AI: "false",
        SETTLEMENT_WORKER_PORT: "8899",
        SETTLEMENT_DB: join(dir, "run.sqlite"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Worker startup timed out")),
        5000,
      );
      child.stdout.on("data", (b) => {
        if (String(b).includes("Settlement worker:")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(Error(`Worker exited ${code}`));
      });
    });
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal(
      (
        await fetch(base + "/runs", {
          headers: { Origin: "https://untrusted.example" },
        })
      ).status,
      403,
    );
    const create = await fetch(base + "/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: 4 }),
    });
    assert.equal(create.status, 201);
    const initial = await create.json();
    const modelStatus = await (await fetch(base + "/model/status")).json();
    assert.equal(modelStatus.ready, false);
    assert.equal(JSON.stringify(modelStatus).includes("apiKey"), false);
    const modelRequest = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "model-disabled", expectedVersion: 0 }),
    };
    assert.equal(
      (await fetch(`${base}/runs/${initial.run.id}/model-step`, modelRequest))
        .status,
      403,
    );
    const disabled = await fetch(`${base}/runs/${initial.run.id}/model-step`, {
      ...modelRequest,
      headers: { ...modelRequest.headers, Origin: "http://localhost:5173" },
    });
    assert.equal(disabled.status, 400);
    assert.match((await disabled.json()).error, /disabled/i);
    const command = async (data) => {
      const res = await fetch(`${base}/runs/${initial.run.id}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      assert.equal(res.status, 200);
      return res.json();
    };
    const resumed = await command({
      id: "resume",
      action: "resume",
      expectedVersion: 0,
    });
    assert.equal(resumed.running, true);
    await new Promise((resolve) => setTimeout(resolve, 1150));
    const live = await (await fetch(`${base}/runs/${initial.run.id}`)).json();
    assert.ok(live.run.snapshots.length > 1);
    const stopped = await command({
      id: "pause",
      action: "pause",
      expectedVersion: live.version,
    });
    assert.equal(stopped.running, false);
    const response = await fetch(`${base}/runs/${initial.run.id}/stream`, {
      signal: AbortSignal.timeout(4000),
    });
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    const reader = response.body.getReader();
    const chunk = await reader.read();
    assert.match(new TextDecoder().decode(chunk.value), /data:/);
    await reader.cancel();
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
