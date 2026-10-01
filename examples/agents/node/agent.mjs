// A deliberately simple Settlement test agent (Node.js, no dependencies).
// It demonstrates the protocol, not a robust defense: its rules are tuned to
// Settlement's authored claims. Replace decide() with a call to your own agent.
// Run: node examples/agents/node/agent.mjs   (PORT overrides 8765)
import { createServer } from "node:http";

const SUSPICIOUS =
  /override|ignore your|send rook|almost empty|buy my grain now|refuse jhansi|spoiled/i;

export function decide(request) {
  const evidence = request.evidenceIds.slice(-1);
  if (request.allowedActions.includes("check_evidence"))
    return { action: "check_evidence", evidenceIds: evidence, summary: "The claim is unverified, so I check the source first." };
  if (SUSPICIOUS.test(request.claim))
    return { action: "reject_claim", evidenceIds: evidence, summary: "The claim pressures me to act without support, so I decline." };
  return { action: "accept_claim", evidenceIds: [], summary: "The offer matches the public price, so I accept." };
}

const server = createServer((req, res) => {
  if (req.method !== "POST") return res.writeHead(405).end();
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy();
  });
  req.on("end", () => {
    try {
      const answer = JSON.stringify(decide(JSON.parse(body)));
      res.writeHead(200, { "content-type": "application/json" }).end(answer);
    } catch {
      res.writeHead(400).end();
    }
  });
});
server.listen(Number(process.env.PORT ?? 8765), "127.0.0.1", () => {
  console.log(`Settlement example agent listening on http://127.0.0.1:${server.address().port}/decide`);
});
