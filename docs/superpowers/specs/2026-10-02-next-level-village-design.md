# Settlement: the living village upgrade

The user requested a substantial end-to-end upgrade, including visuals, and selected a rich illustrated fantasy village with a polished strategy-game interface. Prior direction remains: objective-driven agents, playable building/battles, integrated research, free deterministic default and optional configured research models. Existing publication authorization applies to the same public repository.

## Product outcome

The village should visibly develop because of resident coordination. Add a Grow the village objective: a frozen plan and cost ceiling, a second farm, producer upgrades, required Town hall upgrades, resource collection and builder scheduling. Show what will happen before starting. Existing raid and stockpile objectives continue to work. Plans use actual commands, spend actual treasury funds, adapt to manual actions and wait visibly when blocked. Completion waits for construction, not merely spending.

## Presentation

Keep the original painted isometric world and introduce six distinct civilian character sprites, shared resident identity in inspectors, and a more deliberate strategy interface. Palette: deep forest #162c2b, slate #223b43, parchment #f8edcf, brass #d6aa56, ivory #fff9e9, teal #81b3a0. Headlines use a sturdy book serif; controls use a readable humanist sans. The world is the main content: compact top resource ledger, restrained navigation, one resident command board, bottom action dock. Development details belong to an explicit plan view. Phone layouts use a compact command summary and readable sheet content, not two competing expanded overlays. All targets remain keyboard accessible and respect reduced motion.

## Engineering boundaries

Pure domain planning remains in lib/game. New saved fields are optional for existing version-2 campaigns; legacy crew version-1 states remain loadable. No free rewards, duplicate construction, fabricated locations or unbounded budgets. Automatically selected construction sites must be valid and reachable, and the planner must recover when manual building or relocation invalidates them. Serial identifiers must propagate after build commands. Only one task owns a construction step and only one resident owns a task. Pausing, cancellation, rest, raids, Council, Research and offline restoration retain their existing semantics.

UI changes split resident identity, development plan and presentation from the large game component where practical. Do not introduce a new rendering framework or external runtime dependency solely for styling. Generated art is copied into public/game, attributed and documented. No provider keys or developer execution details in player flows.

## Verification

Test dependency completion, treasury spending, budget exhaustion, builders occupied, no reachable site, manual interference, unique IDs, old-save migration and deterministic continuation. Verify free playable progression, construction plan, map feedback, dialogs, research, save/reload and phone controls in an isolated browser origin. Run all tests, HTTP integration, reference evaluation reproduction, types, lint and production build; update screenshots and player docs from the result. Publish to the established repository only after verification.
