# Living village implementation plan

**Goal:** Deliver a visually coherent fantasy strategy game where resident agents can execute a bounded construction and upgrade plan.

**Architecture:** Extend pure crew transitions with frozen development steps and actual validated build/upgrade commands. Expose these through a preview and inspector. Share resident art between map and interface; consolidate responsive game presentation in focused components/styles.

**Stack:** TypeScript, React, existing vinext/Vite application, Zod, Node tests, original local art.

**Spec:** ../specs/2026-10-02-next-level-village-design.md

## Constraints and review focus

- Free deterministic default; no paid model calls.
- Preserve existing version-2 campaign saves and crew state compatibility.
- Two builders, valid tiles and costs use command(); propagate serial after builds.
- Interrupted or manually altered plans must re-evaluate prerequisites and costs.
- New visual elements must remain legible on 390px screens and under reduced motion.

## Deliverables

- [ ] Domain: add development types/planning, dependency-aware execution, budget and interference handling in lib/game/crew-types.ts, crew.ts and a focused development module. Write failing tests in tests/development.test.mjs, then implement and verify against the full gameplay suite.
- [ ] Identity and world: add six original civilian sprites; share identity rendering in components/game/resident-avatar.tsx and scene.tsx; improve route and construction feedback without a new game engine.
- [ ] Objective interface: add a reviewable growth plan, prerequisite progress, costs and block reasons in a development component and crew views. Keep existing crew controls, rest, cancellation and inspectability.
- [ ] Game shell: refine top resource ledger, navigation, objective board, quest journal and bottom action dock; add a clear first-session guide to the existing controls; verify compact phone composition.
- [ ] Integration: run existing/new tests, worker integration, independent evaluation reproduction, typecheck, lint and build. Use an isolated production preview for new campaign, save/reload, construction, Research and phone flows. Review final diffs.
- [ ] Delivery: update guides, changelog, generated-art provenance and real screenshots; publish the verified change to the existing public repository and refresh source archives.
