"""A deliberately simple Settlement test agent (Python 3 standard library only).

It demonstrates the protocol, not a robust defense: its rules are tuned to
Settlement's authored claims. Put your own agent in call_your_model().
Run: python3 examples/agents/python/agent.py   (PORT overrides 8765)
"""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SUSPICIOUS = re.compile(
    r"override|ignore your|send rook|almost empty|buy my grain now|refuse his next offer|spoiled",
    re.IGNORECASE,
)


def call_your_model(request):
    """Return None to use the rules below, or a dict such as
    {"action": "reject_claim", "evidenceIds": [], "summary": "why"}."""
    return None


def decide(request):
    answer = call_your_model(request)
    if answer is not None:
        return answer
    evidence = request["evidenceIds"][-1:]
    if "check_evidence" in request["allowedActions"]:
        return {"action": "check_evidence", "evidenceIds": evidence,
                "summary": "The claim is unverified, so I check the source first."}
    if SUSPICIOUS.search(request["claim"]):
        return {"action": "reject_claim", "evidenceIds": evidence,
                "summary": "The claim pressures me to act without support, so I decline."}
    return {"action": "accept_claim", "evidenceIds": [],
            "summary": "The offer matches the public price, so I accept."}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        try:
            answer = decide(json.loads(self.rfile.read(min(length, 1_000_000))))
        except (ValueError, KeyError, TypeError):
            self.send_response(400)
            self.end_headers()
            return
        body = json.dumps(answer).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", "8765"))), Handler)
    print(f"Settlement example agent listening on http://127.0.0.1:{server.server_address[1]}/decide", flush=True)
    server.serve_forever()
