# Reproducible evaluation reports

Settlement compares three deterministic social policies across authored scenarios. This is a small inspectable experiment, not a benchmark of language-model safety or a claim about real human behavior. No model calls are made by comparisons.

## Run and inspect in the browser

1. Open **Research → Compare**.
2. Choose a scenario, first seed, number of seeds and ticks per run. An adversarial scenario includes honest controls; selecting honest controls alone runs them once. **All scenarios + honest controls** includes all four families.
3. Choose **Run comparison**. Progress advances after each complete run. Cancel discards the unfinished report.
4. Read the denominator beside each rate. Select an included scenario and seed to inspect a particular policy's complete run. The inspector reconstructs that exact configuration, without player interventions.
5. **Export report** saves reproducible JSON. **Export CSV** saves aggregate rows; rates are fractions from 0 to 1, with blank cells for absent denominators.
6. **Import & verify**, or **Verify a pasted report**, independently runs the submitted cases and compares their results. Imported totals are never accepted without reproduction.

The browser uses the same evaluator as the CLI. Importing replaces the displayed comparison, not the campaign or a saved research run. Reports require the matching engine version.

## Run and verify from the command line

```bash
# Regenerate the default report: seeds 1–10, 60 ticks, all scenarios/policies
npm run evaluate

# Reproduce a report without overwriting it; exit nonzero on failure
npm run evaluate -- --verify docs/evaluation-results.json
```

CI uses the verification command against the checked-in artifact. An intentional engine change requires reviewing the new results and regenerating the artifact, not simply accepting a stale report.

## Format and bounds

Format version 1 records the engine version, manifest, individual cases, aggregate rows and `modelCalls: 0`. Each case contains its configuration, metrics, every tick's state checksum, an evidence checksum and inspection count. Full snapshots are reconstructed when needed; they are not repeated in the compact report.

The manifest accepts known scenarios and policies only, unique seeds from 0 through 999999, at most 10 seeds, 20–150 ticks and at most 120 cases. Imports also have a 2 MB size limit. The canonical order is scenario, policy, then ascending seed. Missing, duplicated, reordered or altered cases and rows are rejected. Valid reordered JSON object properties remain equivalent.

Every generated run must pass resource invariants and exact replay of state and audit evidence. Verification regenerates the complete manifest and compares all recorded fields, rather than trusting a checksum or an aggregate in isolation. Checksums are inexpensive change detectors, **not cryptographic signatures**: a reproducible report proves consistency with this engine, not who authored or published it. A different matching engine implementation must be independently reviewed.

## Reading the results

- **Attack success:** successful attacks / evaluable attacks. Unresolved and pending incidents remain separate and are not treated as resisted attacks.
- **Harm:** resource units lost to successful attacks under the authored rules.
- **Detection:** attacks whose false evidence was identified.
- **Honest refusal:** refused honest offers / delivered honest offers. This reveals the cost of blanket suspicion.
- **Inspection count:** actual inspection events, a simple measure of evidence-gathering effort.
- A zero denominator is `null` in JSON and **Not applicable** in the UI, rather than an invented 0%.

## Reference results

The checked-in report uses engine 1.1.0, seeds 1–10, 60 ticks and 120 runs. Each table cell aggregates ten matched runs; all denominators below are 40.

| Scenario                        | Trust first   | Cautious      | Check evidence |
| ------------------------------- | ------------- | ------------- | -------------- |
| Scarcity: successful attacks    | 36/40 (90%)   | 7/40 (17.5%)  | 0/40 (0%)      |
| Reputation: successful attacks  | 35/40 (87.5%) | 7/40 (17.5%)  | 0/40 (0%)      |
| Injection: successful attacks   | 36/40 (90%)   | 7/40 (17.5%)  | 0/40 (0%)      |
| Honest controls: refused offers | 4/40 (10%)    | 33/40 (82.5%) | 0/40 (0%)      |

Check evidence performs 40 inspections in each scenario family. Its advantage is expected because the scenarios provide inspectable evidence and the policy is designed to use it. These results do not establish robustness to unseen attacks or natural-language model outputs. Additional scenarios should include independent honest controls and avoid making success synonymous with refusing every request.
