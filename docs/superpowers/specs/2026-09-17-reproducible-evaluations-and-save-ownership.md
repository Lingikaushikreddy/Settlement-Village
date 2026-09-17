# Reproducible evaluations and campaign save ownership

The user authorized further practical improvements after supplying the September 17 product requirements document. This increment strengthens two existing flows: comparing agent policies and safely saving the local village. The free default and existing simulation semantics remain unchanged.

## Evaluation reports

Use one browser-compatible evaluator for Research → Compare and the evaluation CLI. A versioned compact report contains the exact engine version, scenario/policy/seed/tick manifest, every case's metrics and checkpoints, an evidence checksum, inspection counts and recomputed aggregate rows. Include honest controls once per policy/seed; never label missing attack denominators as a zero-percent success rate. Keep attack success, explicit resistance, unresolved and pending outcomes separate.

Manifests permit existing scenario and policy IDs only, at most ten unique seeds and 120 cases, with 20–150 ticks per case. Validate imported data before simulation. Every generated case must pass conservation checks and exact replay. Verification regenerates the complete declared matrix and compares all case records and aggregates; omitted, duplicate, altered or unsupported records fail. Checksums are deterministic comparison aids, not cryptographic signatures or proof of general agent safety.

Run one case at a time with progress and cancellation so the browser can respond. Import/export compact JSON reports, export aggregate CSV, and inspect an actual included case by selecting its scenario and seed. Existing single-run exports remain the path for full evidence records. The CLI generates the same report and independently verifies a supplied file with a nonzero exit on failure. CI checks the documented reference report.

## Campaign ownership

Reproduction found that two open tabs can silently overwrite valid campaign progress through their autosave or pagehide callbacks. Give the existing save key one exclusive browser Web Lock. Only the owner mounts the playable game and its timers; other tabs show an accessible explanation and an explicit retry after closing the owner.

Acquire ownership before reading the latest saved state. On release, synchronously stop all simulation/save callbacks and flush the owner before allowing another tab to acquire the lock. Stale cleanup and pagehide handlers must not write. Unsupported browsers show an explanation and original-save export rather than pretending safe persistence exists. Preserve unreadable saved data until the player exports it or explicitly chooses a fresh village. No unrequested reset or migration of the user's actual local save occurs during testing.

Browser verification also reproduced a confirmed player action being lost on immediate tab termination before autosave. Persist player commands and imported saves immediately; save ongoing simulation periodically and when visibility changes to hidden. Keep pagehide/cleanup flushing as an additional opportunity, not a guarantee that a terminating browser will emit those events.

## Verification and delivery

Core tests cover complete matrices, stable reports, honest controls, zero denominators, tampering, input bounds and cancellation. Session tests cover two owners, latest-state acquisition, cleanup ordering, stale callbacks, unsupported APIs and corrupt-save recovery. Browser checks use an isolated origin for comparison generation/import/inspection, phone layout and two-tab ownership. Run all existing tests, HTTP integration, type checking, lint and build. Document actual results and limits, then update the existing public repository under the user's established publishing authorization.
