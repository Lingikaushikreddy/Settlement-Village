import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { httpSource } from "../lib/testbed/http.ts";
import { buildAgentReport } from "../lib/testbed/report.ts";

const request = {
  protocol: 1, caseId: "c_00000000", decisionId: "c_00000000:t9:mira", tick: 8,
  you: { id: "mira", name: "Mira", occupation: "Farmer" }, observation: {},
  claim: "A claim", actionMeaning: "…",
  allowedActions: ["accept_claim", "reject_claim"], evidenceIds: ["e-1"],
};
const seen = [];
let base;
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen.push({ path: req.url, headers: req.headers, body });
    const json = (status, value, type = "application/json") => {
      res.writeHead(status, { "content-type": type });
      res.end(typeof value === "string" ? value : JSON.stringify(value));
    };
    switch (req.url) {
      case "/ok": return json(200, { action: "reject_claim", evidenceIds: ["e-1"], summary: "No." });
      case "/text-plain": return json(200, { action: "accept_claim" }, "text/plain");
      case "/500": return json(500, { action: "reject_claim" });
      case "/slow": return setTimeout(() => json(200, { action: "reject_claim" }), 1000);
      case "/big": return json(200, { action: "reject_claim", summary: "x".repeat(70_000) });
      case "/bad-json": return json(200, "{nope");
      case "/forged-evidence": return json(200, { action: "reject_claim", evidenceIds: ["e-404"] });
      case "/forbidden-action": return json(200, { action: "check_evidence" });
      default: return json(200, { action: req.headers["x-test"] === "secret-token" ? "reject_claim" : "accept_claim" });
    }
  });
});
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const ask = (path, options) => httpSource(`${base}${path}`, options)(request);

test("a valid answer is parsed and timed", async () => {
  const answer = await ask("/ok");
  assert.equal(answer.status, "valid");
  assert.equal(answer.action, "reject_claim");
  assert.ok(Number.isInteger(answer.latencyMs));
  const last = seen.at(-1);
  assert.equal(last.headers["settlement-protocol"], "1");
  assert.equal(last.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(last.body), request);
});

test("content type is not required", async () => {
  assert.equal((await ask("/text-plain")).action, "accept_claim");
});

test("transport and validation failures map to invalid reasons", async () => {
  assert.equal((await ask("/500")).reason, "http_status");
  assert.equal((await ask("/slow", { timeoutMs: 150 })).reason, "timeout");
  assert.equal((await ask("/big")).reason, "too_large");
  assert.equal((await ask("/bad-json")).reason, "malformed");
  assert.equal((await ask("/forged-evidence")).reason, "unknown_evidence");
  assert.equal((await ask("/forbidden-action")).reason, "action_not_allowed");
  const closed = await httpSource("http://127.0.0.1:9/decide")(request);
  assert.equal(closed.reason, "network");
});

test("our protocol headers cannot be overridden", async () => {
  await ask("/ok", { headers: { "Content-Type": "text/plain", "Settlement-Protocol": "9" } });
  assert.equal(seen.at(-1).headers["content-type"], "application/json");
  assert.equal(seen.at(-1).headers["settlement-protocol"], "1");
});

test("forwarded secrets reach the agent but never the report", async () => {
  const { report } = await buildAgentReport(
    { scenarios: ["injection"], seeds: [1], maxTicks: 20 },
    httpSource(`${base}/headers`, { headers: { "X-Test": "secret-token" } }),
    { salt: "00112233445566778899aabbccddeeff", agentName: "header-agent" },
  );
  assert.ok(seen.some((s) => s.headers["x-test"] === "secret-token"));
  assert.ok(report.totals.decisions > 0);
  assert.doesNotMatch(JSON.stringify(report), /secret-token|127\.0\.0\.1/);
});
