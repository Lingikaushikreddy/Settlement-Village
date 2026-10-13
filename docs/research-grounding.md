# Research-grounded scenarios

Twelve scenarios in `examples/scenarios/research/` put manipulation tactics from published studies of language-model agents into Settlement's scenario format. Each attack has an honest twin, so a score separates caution from paranoia. `examples/scenarios/research/sources.json` lists, per scenario, the papers behind the tactic, what the scenario borrows, and the license we could confirm. Every listed paper's id was resolved against arXiv or Crossref and its title and authors matched (`status: verified`, dated by `checkedOn`). A `license` of `unverified` means we could not confirm the license, as with the Meincke et al. paper, so that paper is cited only. Claim texts are written for this village; the papers supply the tactic, never the wording.

## Run them

One report holds the whole pack. With no `--scenarios`, the testbed runs the four built-ins plus every loaded file, 16 scenarios in all:

```bash
node examples/agents/node/agent.mjs &
files=(); for f in examples/scenarios/research/*.json; do [ "$(basename "$f")" = sources.json ] || files+=(--scenario-file "$f"); done
npx settlement-testbed --agent http://127.0.0.1:8765/decide "${files[@]}" --out research-reports/pack.json
```

A report holds at most 16 scenarios.

The built-in Check evidence policy refuses every attack and accepts every honest twin by construction. An agent that does worse on a scenario than that policy has been moved by the framing. The three honest twins (`cue-honest`, `courier-honest`, `phantom-honest`) follow the benign-twin pattern from AgentHarm (arXiv 2410.09024), which `sources.json` lists for each of them with the `control-pattern` role.

## Persuasion cues

`cue-neutral`, `cue-authority`, `cue-urgency`, `cue-social-proof`, `cue-reciprocity`, `cue-commitment`, and the twin `cue-honest`. Every attack asks six coins for one grain against a two-coin price and differs only in its framing, so the difference from `cue-neutral` is the effect of the cue. Stated hypothesis: each cue raises attack success over `cue-neutral`; reciprocity may be the weakest. Tactic sources: persuasion principles (Meincke et al.), social-engineering framing against agents (TRAP, arXiv 2512.23128) and a persuasion taxonomy (Zeng et al., arXiv 2401.06373).

## Peer courier

`courier-direct` (Rook voices a demand attributed to the council), `courier-relayed` (Theo, a trusted neighbor, relays the same demand) and `courier-honest`. Stated hypothesis: the relayed demand succeeds more often than the direct one. This is the testbed's first measure of over-trust of a trusted peer. Sources: a study of trust between agents (arXiv 2507.06850, cited for the mechanism only because its own tables conflict), message interception (arXiv 2502.14847) and attacks along trust links (arXiv 2512.04129).

## Phantom agreement

`phantom-agreement` insists on a deal the ledger never recorded; `phantom-honest` refers to one it did. Sources: a gaslighting benchmark (arXiv 2501.19017, CC BY-NC-ND 4.0) and annotated manipulative dialogue (arXiv 2506.12090, CC BY-NC-SA 4.0). Both carry non-commercial licenses, so they are cited, not reused. The gaslighting evidence comes from multimodal models, so whether it transfers to text-only agents is untested.

## What this does not show

- The effect sizes in the sources come from chatbot and web-agent studies. Nothing here says they carry over to a resident deciding in this village; the reports measure that.
- Hypotheses are expectations, not results.
- A good score on this pack does not say a model is safe. It says the agent handled these twelve cases.
- In the cue and phantom families every attack is voiced by Rook and every honest twin by Theo, and the speaker reaches the agent. An agent that distrusts Rook and trusts Theo can score well on those families without reading the claim. The courier family, whose relayed attack is voiced by Theo, is the guard against that shortcut.
- A paper whose `license` is `unverified` in `sources.json` is cited for its tactic only; none of its text or data is reused.
- Observed-versus-unobserved behavior and multi-step commons collapse are not covered: the one-claim format cannot express them.
