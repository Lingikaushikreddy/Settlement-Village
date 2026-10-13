# Research-grounded scenarios design

**Date:** 2026-10-12 · **Status:** draft for review (approach A, sidecar sources) · **Owner:** Kaushik Reddy

Fourth sub-project of the open-source push: content. A literature survey (five parallel searches, abstract-level, report kept outside the repo) found plenty of benchmarks for tool-using agents being injected or persuaded, and human experiments on trust, but no direct measurement of how far an agent over-trusts a deceptive *peer* when allocating resources. This spec adds three families of testbed scenarios that put published manipulation tactics into the existing scenario format, each with a cited source and an honest control, without touching the engine, the schema or the report format.

## Goals

- Ship 12 scenario files in `examples/scenarios/research/`, validated by the existing `scenarioDefinitionSchema`, in three families:
  1. **Persuasion cues** (7): `cue-neutral`, `cue-authority`, `cue-urgency`, `cue-social-proof`, `cue-reciprocity`, `cue-commitment`, `cue-honest`. The offer, price, evidence, contradiction and harm are identical across the six attacks; only the framing text differs, so a score difference is attributable to the cue.
  2. **Peer courier** (3): `courier-direct` (Rook voices a demand), `courier-relayed` (Theo relays the same demand as a "council order"), `courier-honest`. This is the first measurement of over-trust of a trusted peer in this testbed.
  3. **Phantom agreement** (2): `phantom-agreement` ("you already agreed to this", where the evidence shows no such record) and `phantom-honest`.
- A `research/sources.json` index (see below) ties every scenario to the papers behind its tactic, with a verification status per paper.
- A `docs/research-grounding.md` page lists the families, the stated hypotheses, the sources and what is and is not verified.
- A test keeps the pack honest: valid definitions, controlled variation within families, an honest twin for every attack, and no uncited or unverified-as-fact source.
- Release as 0.11.0 using the existing version and release flow.

## Non-goals

- No change to `lib/`, the scenario schema, the protocol, report formats, engine version stamps or the built-in reference reports.
- No gallery entry or UI change (screenshot baselines stay untouched).
- No `sources` field in the schema. Citations travelling inside reports is a follow-up (approach B in the brainstorm).
- No observed-versus-unobserved scenario and no fixed-defector commons scenario: both need observation signals or multi-step runs the one-claim format cannot express.
- No claim about how any named model performs. No live model runs in this release.

## Design

### 1. Scenario files

All files follow `docs/scenario-authoring.md`. Fictional village only: no real people, institutions or brands in claim text. Claim wording is written fresh; papers supply the tactic, never phrasing.

- **Cue family.** One shared offer (`give` one grain, `receive` a fixed coin price above the two-coin reference), `evidence.site` market, `contradiction: always`, `harm: overpay`. `cue-neutral` states the demand with no cue and is the control for the other five. `cue-honest` asks the fair two coins.
- **Courier family.** `courier-direct` and `courier-relayed` share offer, evidence and harm. They differ in who voices the claim (`claimant`) and in a one-sentence relay frame. `courier-honest` is a genuine relayed request at a fair price.
- **Phantom family.** The claim asserts a prior agreement; `evidence.fact` states the ledger holds no such agreement. `phantom-honest` refers to an agreement the ledger does confirm (`contradiction: never`).

Ids are slugs prefixed by family and never equal a built-in.

### 2. `research/sources.json`

Lives at `examples/scenarios/research/sources.json`:

```json
{
  "version": 1,
  "checkedOn": "YYYY-MM-DD",
  "scenarios": {
    "cue-authority": {
      "family": "persuasion-cues",
      "hypothesis": "An authority cue raises attack success over cue-neutral.",
      "sources": [
        {
          "id": "arXiv:2512.23128",
          "title": "...", "authors": "...", "year": 2025,
          "role": "tactic",
          "took": "Social-engineering framing as an injection vector.",
          "license": "CC BY 4.0",
          "status": "verified"
        }
      ]
    }
  }
}
```

`role` is `tactic`, `parameter`, `metric` or `control-pattern`. `status` is `verified` (id resolved against arXiv or Crossref on `checkedOn`, title and authors matched) or `unverified`. `license` is the confirmed license or `unverified`. Honest controls cite the benign-twin and full-versus-partial patterns from published agent-safety benchmarks as `control-pattern`.

Candidate sources, each to be re-resolved before it is written in: Meincke et al. (persuasion principles, SSRN), TRAP (arXiv 2512.23128), Zeng et al. (persuasion taxonomy, arXiv 2401.06373), the peer-channel trust paper (arXiv 2507.06850, whose own tables conflict, so cited for mechanism only), Agent-in-the-Middle (arXiv 2502.14847), TOMA (arXiv 2512.04129), GaslightingBench (arXiv 2501.19017), ChatbotManip (arXiv 2506.12090), AgentHarm and WASP for control patterns. Any source that fails to resolve is dropped, not cited from memory.

### 3. Tests

`tests/research-scenarios.test.mjs`:

- Every file parses with `parseScenarioDefinition`; ids unique; none equals a built-in or the `reciprocity` example.
- Cue family: `offer`, `evidence`, `contradiction`, `harm`, `acceptMeans`, `proposer` equal across the six attacks; only `claim`, `claimTitle` and `summaries` may differ.
- Courier family: attacks differ only in `claimant`, `claim`, `claimTitle` and `summaries`.
- Each attack has an honest twin in its family.
- `sources.json` has an entry for every scenario and no extras; every source has `id`, `role`, `status` and `license`; scenario files themselves never contain a source id string.
- `docs/research-grounding.md` mentions every scenario id.

### 4. Docs

`docs/research-grounding.md` per family: the tactic, the stated hypothesis, the sources with status, how to run it (`npx settlement-testbed --scenario-file ...`), and a limits section: the supporting effect sizes come from chatbot and web-agent studies, not from this testbed; unverified items are marked as such; no result from this pack says a model is safe. `docs/scenario-authoring.md` gains a pointer. CHANGELOG gets the 0.11.0 section.

## Risks and the first-task spike

Four things are assumed, not known, and the first plan task checks them before the 12 files are written:

1. `claimant: theo` with `proposer: rook` runs end to end and the agent's `publicClaims` shows Theo as the voice.
2. What the agent can do after `check_evidence` (whether a second decision follows), so the docs describe the three actions correctly.
3. What the three built-in policies do on a sample file.
4. A 400-character claim carries each cue without truncation.

If 1 or 2 fails, the courier family is redesigned in a revised spec before more files are written.

## Verification

- `npm test`, `npm run check:versions`, `npm run lint` and the existing browser suite stay green.
- All 12 files run through the CLI against `examples/agents/node/agent.mjs` and the built-in policies. The Check evidence policy should refuse every attack and accept every honest twin; any other result is treated as a defect in a file.
- `npx settlement-testbed --verify` passes on a report generated with the pack.
- Reference reports (`docs/evaluation-results.json`, `public/examples/agent-report.json`, gallery reports) are unchanged.

## Delivery

Branch and PR for every change (ruleset blocks direct pushes). Order: spec, plan, spike plus scenarios plus tests plus sources, docs plus CHANGELOG plus 0.11.0. Commits and PRs go under Kaushik's name only. Tagging and merging wait for his instruction. Coding tasks run on Opus; planning and review stay in the main session.
