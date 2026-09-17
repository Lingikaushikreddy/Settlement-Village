# v0.2.0 verification

Verified September 17, 2026 against the reproducible-evaluation and campaign-ownership increment. Browser checks used an isolated production preview at `http://127.0.0.1:5180`; the user's campaign origin was not used for gameplay tests.

## Automated checks

- **95 tests passed**, including ten evaluation tests and seven campaign-session tests.
- **One HTTP integration flow passed**, covering worker controls, origin protection and event streaming.
- TypeScript, ESLint and the production build passed.
- CLI verification independently reproduced all **120 cases** in `docs/evaluation-results.json`, including case metrics, every checkpoint, evidence checksums and aggregate rows.
- CI now runs that reproduction command in addition to the existing tests, types, lint and build.

Evaluation tests cover repeated deterministic generation, exact replay, bounded inputs, complete case matrices, honest controls, absent denominators, cancellation, changed metrics/evidence/checkpoints and unsupported versions. Campaign tests cover exclusive ownership, latest-save acquisition, stop/flush ordering, late callbacks, abandoned effects, unavailable APIs/storage and corrupt-save preservation/replacement.

## Browser checks

- A second campaign tab displayed the ownership explanation and could not mount a playable village. Retrying after the owner closed loaded the saved campaign.
- Reproduced the immediate-close loss: a confirmed collection raised gold from 1751 to 2151, but the next tab initially restored 1751. After adding immediate persistence for player actions, repeating collection and closing in the same browser operation restored **2151**. Simulation still saves periodically; forced termination can lose the last simulation interval.
- Compared scarcity and honest controls at seed 7, 20 ticks: six cases with correct denominators and no paid calls.
- Exported JSON and CSV. Imported the downloaded JSON through the file chooser and reproduced all six cases. Valid pasted JSON also reproduced; increasing the recorded harm total caused a visible verification failure.
- Opened Check evidence from the report and exported its full run. The exported configuration was exactly `{seed: 7, scenario: "scarcity", policy: "evidence", maxTicks: 20}`, with 21 checkpoints.
- Honest-only comparison produced three cases, with absent attack denominators displayed as **Not applicable**.
- Started the 120-case/150-tick configuration, observed progress, and cancelled. The cancelled report was not displayed as complete.
- Inspected the desktop controls and a 390 × 844 phone viewport. Controls fit the phone; document width and scroll width were both 390 pixels. The wide results table has its own horizontal scroll region.
- No application errors were reported in the inspected browser logs.

## Scope of this evidence

Checks cover the deterministic local application. Damaged-save recovery, unavailable storage and unavailable Web Locks were exercised by controller tests; browser storage was not artificially corrupted. Model tests use injected responses. No paid provider was contacted and no hosted game or shared research worker was deployed.

The evidence policy is tailored to the authored scenarios. Reproducing their outcomes is not evidence of general language-model safety. Checksum matching establishes consistency with this engine, not cryptographic provenance.
