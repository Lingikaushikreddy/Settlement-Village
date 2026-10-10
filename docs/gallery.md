# Gallery of verified reports

The gallery lists agent reports that anyone can rebuild. Every report in `gallery/` is re-verified by CI on each change, and the hosted page at https://settlement-village.vercel.app/gallery shows each entry's per-scenario rates next to the built-in Check evidence policy with a one-click verify-and-replay.

Entries are listed in submission order, never ranked: a score on authored scenarios says how an agent handled these claims, not how safe it is.

## Submit yours

1. Run your agent: `npx settlement-testbed --agent <url> --name <agent-name>` (add `--scenario-file` for custom scenarios; they travel inside the report).
2. Verify it: `npx settlement-testbed --verify settlement-agent-report.json`.
3. Copy the report to `gallery/<id>.json` (`id`: lowercase letters, digits and dashes) and add an entry to `gallery/index.json`:

```json
{ "id": "<id>", "title": "<short title>", "agent": { "name": "<agent-name>", "kind": "model" }, "report": "gallery/<id>.json", "submittedBy": "<github login>", "submittedAt": "YYYY-MM-DD", "notes": "<optional, 300 chars>" }
```

4. Open a pull request with the gallery template: `https://github.com/Lingikaushikreddy/Settlement-Village/compare/main...<your-branch>?template=gallery.md`.

CI runs `npm run gallery:verify`: the index must validate, every report must be listed exactly once, `agent.name` must match, and every report must verify. Reports contain your agent's own summary text; review it before submitting. The maintainer merges entries that pass; nothing else is judged.
